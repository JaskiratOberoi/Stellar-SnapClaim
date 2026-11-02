using Dapper;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;
using SnapClaim.Api.Services;

namespace SnapClaim.Api.Endpoints;

/// <summary>Company administration: people, reporting lines, categories and the spending policy.</summary>
public static class AdminEndpoints
{
    public sealed record UserInput(string Email, string FullName, string Role, Guid? ManagerId, string? EmployeeCode, string? Department, string? Password, bool? IsActive);
    public sealed record ResetPasswordRequest(string NewPassword);
    public sealed record CategoryInput(string Code, string Name, string? Icon, int? SortOrder, bool? IsActive);
    public sealed record RuleInput(Guid? CategoryId, decimal? MaxPerClaim, decimal? MaxPerMonth, decimal? ReceiptRequiredAbove, int? MaxDaysToSubmit, string? Notes);

    public static void Map(RouteGroupBuilder api)
    {
        // People list is visible to approvers too (to filter the queue); writes are admin-only.
        api.MapGet("/users", async (HttpContext http, Db db, bool? includeInactive) =>
        {
            var me = Current.From(http.User);
            me.RequireApprover();
            await using var conn = await db.Open();
            var rows = await conn.QueryAsync<AuthEndpoints.UserRow>(AuthEndpoints.UserSql + " WHERE u.company_id = @companyId" + (includeInactive == true ? "" : " AND u.is_active") + " ORDER BY u.full_name", new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows.Select(AuthEndpoints.Profile) });
        }).RequireAuthorization(Policies.User);

        var g = api.MapGroup("/admin").RequireAuthorization(Policies.SuperAdmin);

        g.MapPost("/users", async (UserInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            ValidateUser(input, creating: true);
            await using var conn = await db.Open();
            await CheckManager(conn, me.CompanyId, input.ManagerId);
            if (await conn.ExecuteScalarAsync<bool>("SELECT EXISTS(SELECT 1 FROM app_user WHERE email = @email)", new { email = input.Email.Trim() }))
                throw ApiException.Conflict("email_taken", "A user with this email already exists");
            var id = await conn.ExecuteScalarAsync<Guid>("""
                INSERT INTO app_user(company_id, email, full_name, employee_code, department, password_hash, role, manager_id)
                VALUES (@companyId, @email, @name, @code, @dept, @hash, @role::user_role, @managerId) RETURNING id
                """, new { companyId = me.CompanyId, email = input.Email.Trim(), name = input.FullName.Trim(), code = input.EmployeeCode?.Trim(), dept = input.Department?.Trim(), hash = Bootstrap.Hash(input.Password!), role = input.Role, input.ManagerId });
            var row = await conn.QuerySingleAsync<AuthEndpoints.UserRow>(AuthEndpoints.UserSql + " WHERE u.id = @id", new { id });
            await Audit.Log(conn, null, http, me, "user.create", "user", id, $"Added {input.FullName.Trim()} ({input.Email.Trim()}) as {input.Role}", new { input.Role, input.ManagerId, input.EmployeeCode, input.Department });
            return Results.Created($"/api/v1/users/{id}", AuthEndpoints.Profile(row));
        });

        g.MapPut("/users/{id:guid}", async (Guid id, UserInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            ValidateUser(input, creating: false);
            if (input.ManagerId == id) throw ApiException.Validation("A user cannot be their own manager");
            await using var conn = await db.Open();
            await CheckManager(conn, me.CompanyId, input.ManagerId);
            var existing = await conn.QuerySingleOrDefaultAsync<AuthEndpoints.UserRow>(AuthEndpoints.UserSql + " WHERE u.id = @id AND u.company_id = @companyId", new { id, companyId = me.CompanyId })
                ?? throw ApiException.NotFound("User");
            if (id == me.UserId && (input.Role != Roles.SuperAdmin || input.IsActive == false)) throw ApiException.Validation("You cannot demote or deactivate yourself");
            var roleChanged = existing.Role != input.Role || (input.IsActive is { } a && a != existing.IsActive);
            await conn.ExecuteAsync("""
                UPDATE app_user SET email = @email, full_name = @name, employee_code = @code, department = @dept, role = @role::user_role, manager_id = @managerId,
                                    is_active = coalesce(@isActive, is_active), session_version = session_version + @bump, updated_at = now()
                WHERE id = @id
                """, new { id, email = input.Email.Trim(), name = input.FullName.Trim(), code = input.EmployeeCode?.Trim(), dept = input.Department?.Trim(), role = input.Role, input.ManagerId, input.IsActive, bump = roleChanged ? 1 : 0 });
            var row = await conn.QuerySingleAsync<AuthEndpoints.UserRow>(AuthEndpoints.UserSql + " WHERE u.id = @id", new { id });
            await Audit.Log(conn, null, http, me, input.IsActive == false && existing.IsActive ? "user.deactivate" : "user.update", "user", id, $"Updated {input.FullName.Trim()}: {input.Role}{(input.IsActive == false ? ", inactive" : "")}{(existing.Role != input.Role ? $" (was {existing.Role})" : "")}", new { input.Role, input.ManagerId, input.IsActive, previous_role = existing.Role });
            return Results.Ok(AuthEndpoints.Profile(row));
        });

        g.MapPost("/users/{id:guid}/reset-password", async (Guid id, ResetPasswordRequest req, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8) throw ApiException.Validation("Password must be at least 8 characters");
            await using var conn = await db.Open();
            var n = await conn.ExecuteAsync("UPDATE app_user SET password_hash = @hash, session_version = session_version + 1, updated_at = now() WHERE id = @id AND company_id = @companyId",
                new { id, companyId = me.CompanyId, hash = Bootstrap.Hash(req.NewPassword) });
            if (n == 0) throw ApiException.NotFound("User");
            await Audit.Log(conn, null, http, me, "user.reset_password", "user", id, "Reset a person's password");
            return Results.NoContent();
        });

        g.MapGet("/categories", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var rows = await conn.QueryAsync<CatalogueEndpoints.CategoryRow>(CatalogueEndpoints.CategorySql + " ORDER BY sort_order, name", new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows });
        });

        g.MapPost("/categories", async (CategoryInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            ValidateCategory(input);
            await using var conn = await db.Open();
            var id = await conn.ExecuteScalarAsync<Guid>("""
                INSERT INTO category(company_id, code, name, icon, sort_order, is_active) VALUES (@companyId, @code, @name, @icon, @sort, coalesce(@isActive, true))
                ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active RETURNING id
                """, new { companyId = me.CompanyId, code = input.Code.Trim().ToLowerInvariant(), name = input.Name.Trim(), icon = input.Icon ?? "receipt", sort = input.SortOrder ?? 100, input.IsActive });
            await Audit.Log(conn, null, http, me, "category.save", "category", id, $"Saved category {input.Name.Trim()}", new { input.Code, input.IsActive });
            return Results.Ok(await conn.QuerySingleAsync<CatalogueEndpoints.CategoryRow>(CatalogueEndpoints.CategorySql + " AND id = @id", new { companyId = me.CompanyId, id }));
        });

        g.MapPut("/categories/{id:guid}", async (Guid id, CategoryInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            ValidateCategory(input);
            await using var conn = await db.Open();
            var n = await conn.ExecuteAsync("UPDATE category SET code = @code, name = @name, icon = @icon, sort_order = @sort, is_active = coalesce(@isActive, is_active) WHERE id = @id AND company_id = @companyId",
                new { id, companyId = me.CompanyId, code = input.Code.Trim().ToLowerInvariant(), name = input.Name.Trim(), icon = input.Icon ?? "receipt", sort = input.SortOrder ?? 100, input.IsActive });
            if (n == 0) throw ApiException.NotFound("Category");
            await Audit.Log(conn, null, http, me, "category.save", "category", id, $"Saved category {input.Name.Trim()}", new { input.Code, input.IsActive });
            return Results.Ok(await conn.QuerySingleAsync<CatalogueEndpoints.CategoryRow>(CatalogueEndpoints.CategorySql + " AND id = @id", new { companyId = me.CompanyId, id }));
        });

        // Replace the whole policy in one call: the app edits it as a table.
        g.MapPut("/policy", async (List<RuleInput> rules, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            if (rules.Count(r => r.CategoryId is null) > 1) throw ApiException.Validation("Only one company-wide rule is allowed");
            if (rules.GroupBy(r => r.CategoryId).Any(g => g.Count() > 1)) throw ApiException.Validation("Duplicate category rule");
            foreach (var r in rules)
                if (r.MaxPerClaim is < 0 || r.MaxPerMonth is < 0 || r.ReceiptRequiredAbove is < 0 || r.MaxDaysToSubmit is < 0)
                    throw ApiException.Validation("Limits cannot be negative");
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            await conn.ExecuteAsync("DELETE FROM policy_rule WHERE company_id = @companyId", new { companyId = me.CompanyId }, tx);
            foreach (var r in rules)
                await conn.ExecuteAsync("""
                    INSERT INTO policy_rule(company_id, category_id, max_per_claim, max_per_month, receipt_required_above, max_days_to_submit, notes)
                    VALUES (@companyId, @categoryId, @maxPerClaim, @maxPerMonth, coalesce(@receiptAbove, 0), @maxDays, @notes)
                    """, new { companyId = me.CompanyId, r.CategoryId, r.MaxPerClaim, r.MaxPerMonth, receiptAbove = r.ReceiptRequiredAbove, maxDays = r.MaxDaysToSubmit, notes = r.Notes?.Trim() }, tx);
            await Audit.Log(conn, tx, http, me, "policy.update", "policy", me.CompanyId, $"Saved the spending policy ({rules.Count} rule(s))", new { rules });
            await tx.CommitAsync();
            var rows = await conn.QueryAsync<CatalogueEndpoints.PolicyRuleRow>(CatalogueEndpoints.PolicySql, new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows });
        });
    }

    private static void ValidateUser(UserInput input, bool creating)
    {
        if (string.IsNullOrWhiteSpace(input.Email) || !input.Email.Contains('@')) throw ApiException.Validation("A valid email is required");
        if (string.IsNullOrWhiteSpace(input.FullName)) throw ApiException.Validation("Full name is required");
        if (!Roles.All.Contains(input.Role)) throw ApiException.Validation("Role must be super_admin, admin, approver or employee");
        if (creating && (string.IsNullOrWhiteSpace(input.Password) || input.Password.Length < 8)) throw ApiException.Validation("Password must be at least 8 characters");
    }

    private static void ValidateCategory(CategoryInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Code) || string.IsNullOrWhiteSpace(input.Name)) throw ApiException.Validation("Code and name are required");
    }

    private static async Task CheckManager(Npgsql.NpgsqlConnection conn, Guid companyId, Guid? managerId)
    {
        if (managerId is null) return;
        var role = await conn.ExecuteScalarAsync<string?>("SELECT role::text FROM app_user WHERE id = @id AND company_id = @companyId AND is_active", new { id = managerId, companyId });
        if (role is null) throw ApiException.Validation("Manager not found");
        if (role == Roles.Employee) throw ApiException.Validation("The approver must have the approver, admin or super admin role");
    }
}
