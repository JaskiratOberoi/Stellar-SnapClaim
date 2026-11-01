using System.Text.Json;
using Dapper;
using Npgsql;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;
using SnapClaim.Api.Services;

namespace SnapClaim.Api.Endpoints;

public static class ClaimEndpoints
{
    public sealed record LineInput(string Description, decimal? Quantity, decimal? UnitPrice, decimal Amount);

    public sealed record ClaimInput(
        string Title, Guid? CategoryId, string? Vendor, DateOnly SpentOn, string? Currency, decimal Amount, decimal? TaxAmount,
        string? Notes, List<LineInput>? Lines, List<Guid>? ReceiptIds, bool Submit = false);

    public sealed class ClaimRow
    {
        public Guid Id { get; set; }
        public long ClaimNo { get; set; }
        public Guid EmployeeId { get; set; }
        public string EmployeeName { get; set; } = "";
        public string? EmployeeCode { get; set; }
        public string? Department { get; set; }
        public Guid? ManagerId { get; set; }
        public string Title { get; set; } = "";
        public Guid? CategoryId { get; set; }
        public string? CategoryCode { get; set; }
        public string? CategoryName { get; set; }
        public string? Vendor { get; set; }
        public DateOnly SpentOn { get; set; }
        public string Period { get; set; } = "";
        public string Currency { get; set; } = "";
        public decimal Amount { get; set; }
        public decimal TaxAmount { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = "";
        public string PolicyFlags { get; set; } = "[]";
        public DateTime? SubmittedAt { get; set; }
        public Guid? DecidedBy { get; set; }
        public string? DecidedByName { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecisionNote { get; set; }
        public DateTime? ClearedAt { get; set; }
        public int ReceiptCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public sealed class LineRow
    {
        public Guid Id { get; set; }
        public string Description { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal Amount { get; set; }
    }

    public sealed class EventRow
    {
        public Guid Id { get; set; }
        public string Action { get; set; } = "";
        public string? Note { get; set; }
        public string? ActorName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public const string ClaimSql = """
        SELECT c.id, c.claim_no, c.employee_id, e.full_name AS employee_name, e.employee_code, e.department, e.manager_id,
               c.title, c.category_id, k.code AS category_code, k.name AS category_name, c.vendor, c.spent_on, c.period,
               c.currency, c.amount, c.tax_amount, c.notes, c.status::text AS status, c.policy_flags::text AS policy_flags,
               c.submitted_at, c.decided_by, d.full_name AS decided_by_name, c.decided_at, c.decision_note, c.cleared_at,
               (SELECT count(*) FROM receipt r WHERE r.claim_id = c.id)::int AS receipt_count, c.created_at, c.updated_at
        FROM claim c
        JOIN app_user e ON e.id = c.employee_id
        LEFT JOIN category k ON k.id = c.category_id
        LEFT JOIN app_user d ON d.id = c.decided_by
        """;

    public static object Shape(ClaimRow c) => new
    {
        id = c.Id, claim_no = c.ClaimNo,
        employee = new { id = c.EmployeeId, full_name = c.EmployeeName, employee_code = c.EmployeeCode, department = c.Department },
        title = c.Title,
        category = c.CategoryId is null ? null : new { id = c.CategoryId, code = c.CategoryCode, name = c.CategoryName },
        vendor = c.Vendor, spent_on = c.SpentOn, period = c.Period, currency = c.Currency, amount = c.Amount, tax_amount = c.TaxAmount,
        notes = c.Notes, status = c.Status,
        policy_flags = JsonDocument.Parse(c.PolicyFlags).RootElement.Clone(),
        submitted_at = c.SubmittedAt, decided_by_name = c.DecidedByName, decided_at = c.DecidedAt, decision_note = c.DecisionNote,
        cleared_at = c.ClearedAt, receipt_count = c.ReceiptCount, created_at = c.CreatedAt, updated_at = c.UpdatedAt,
    };

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/claims");

        // scope=mine (default) | team (my reports) | all (director/admin). Filters: status, period, employee_id, q.
        g.MapGet("/", async (HttpContext http, Db db, string? scope, string? status, string? period, Guid? employeeId, string? q, int? limit, int? offset) =>
        {
            var me = Current.From(http.User);
            scope ??= "mine";
            var where = new List<string> { "c.company_id = @companyId" };
            switch (scope)
            {
                case "mine": where.Add("c.employee_id = @userId"); break;
                case "team": me.RequireApprover(); if (!me.SeesAllClaims) where.Add("e.manager_id = @userId"); where.Add("c.status <> 'draft'"); break;
                case "all": me.RequireDirector(); where.Add("c.status <> 'draft'"); break;
                default: throw ApiException.Validation("scope must be mine, team or all");
            }
            if (!string.IsNullOrEmpty(status)) where.Add("c.status = ANY(@statuses::claim_status[])");
            if (!string.IsNullOrEmpty(period)) where.Add("c.period = @period");
            if (employeeId is not null) where.Add("c.employee_id = @employeeId");
            if (!string.IsNullOrWhiteSpace(q)) where.Add("(c.title ILIKE @q OR c.vendor ILIKE @q OR e.full_name ILIKE @q OR c.claim_no::text = @qexact)");
            var take = Math.Clamp(limit ?? 200, 1, 1000);
            var skip = Math.Max(offset ?? 0, 0);

            await using var conn = await db.Open();
            var args = new
            {
                companyId = me.CompanyId, userId = me.UserId, statuses = (status ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                period, employeeId, q = $"%{q?.Trim()}%", qexact = q?.Trim(), take, skip,
            };
            var sqlWhere = " WHERE " + string.Join(" AND ", where);
            var total = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM claim c JOIN app_user e ON e.id = c.employee_id" + sqlWhere, args);
            var rows = await conn.QueryAsync<ClaimRow>(ClaimSql + sqlWhere + " ORDER BY c.spent_on DESC, c.claim_no DESC LIMIT @take OFFSET @skip", args);
            return Results.Ok(new { items = rows.Select(Shape), total });
        }).RequireAuthorization(Policies.User);

        g.MapGet("/{id:guid}", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var claim = await Load(conn, me, id);
            return Results.Ok(await Detail(conn, claim));
        }).RequireAuthorization(Policies.User);

        g.MapPost("/", async (ClaimInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            Validate(input);
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var currency = input.Currency?.ToUpperInvariant() ?? await conn.ExecuteScalarAsync<string>("SELECT currency FROM company WHERE id = @id", new { id = me.CompanyId }, tx) ?? "INR";
            var id = await conn.ExecuteScalarAsync<Guid>("""
                INSERT INTO claim(company_id, employee_id, title, category_id, vendor, spent_on, currency, amount, tax_amount, notes)
                VALUES (@companyId, @userId, @title, @categoryId, @vendor, @spentOn, @currency, @amount, @tax, @notes) RETURNING id
                """, new { companyId = me.CompanyId, userId = me.UserId, title = input.Title.Trim(), input.CategoryId, vendor = input.Vendor?.Trim(), input.SpentOn, currency, input.Amount, tax = input.TaxAmount ?? 0, notes = input.Notes?.Trim() }, tx);
            await SaveLines(conn, tx, id, input.Lines);
            await AttachReceipts(conn, tx, me, id, input.ReceiptIds);
            await Event(conn, tx, id, me.UserId, "created", null);
            if (input.Submit) await Submit(conn, tx, me, id);
            await tx.CommitAsync();
            var claim = await Load(conn, me, id);
            return Results.Created($"/api/v1/claims/{id}", await Detail(conn, claim));
        }).RequireAuthorization(Policies.User);

        g.MapPut("/{id:guid}", async (Guid id, ClaimInput input, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            Validate(input);
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var claim = await Load(conn, me, id, tx);
            if (claim.EmployeeId != me.UserId) throw ApiException.Forbidden("Only the claimant can edit a claim");
            if (claim.Status is not ("draft" or "rejected")) throw ApiException.Conflict("not_editable", $"A {claim.Status} claim cannot be edited");
            await conn.ExecuteAsync("""
                UPDATE claim SET title = @title, category_id = @categoryId, vendor = @vendor, spent_on = @spentOn, currency = coalesce(@currency, currency),
                                 amount = @amount, tax_amount = @tax, notes = @notes, updated_at = now()
                WHERE id = @id
                """, new { id, title = input.Title.Trim(), input.CategoryId, vendor = input.Vendor?.Trim(), input.SpentOn, currency = input.Currency?.ToUpperInvariant(), input.Amount, tax = input.TaxAmount ?? 0, notes = input.Notes?.Trim() }, tx);
            await conn.ExecuteAsync("DELETE FROM claim_line WHERE claim_id = @id", new { id }, tx);
            await SaveLines(conn, tx, id, input.Lines);
            await conn.ExecuteAsync("UPDATE receipt SET claim_id = NULL WHERE claim_id = @id AND NOT (id = ANY(@keep))", new { id, keep = input.ReceiptIds?.ToArray() ?? [] }, tx);
            await AttachReceipts(conn, tx, me, id, input.ReceiptIds);
            await Event(conn, tx, id, me.UserId, "updated", null);
            if (input.Submit) await Submit(conn, tx, me, id);
            await tx.CommitAsync();
            return Results.Ok(await Detail(conn, await Load(conn, me, id)));
        }).RequireAuthorization(Policies.User);

        g.MapPost("/{id:guid}/submit", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var claim = await Load(conn, me, id, tx);
            if (claim.EmployeeId != me.UserId) throw ApiException.Forbidden("Only the claimant can submit a claim");
            await Submit(conn, tx, me, id);
            await tx.CommitAsync();
            return Results.Ok(await Detail(conn, await Load(conn, me, id)));
        }).RequireAuthorization(Policies.User);

        // Pull a submitted claim back to draft before anyone decides on it.
        g.MapPost("/{id:guid}/withdraw", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var n = await conn.ExecuteAsync("UPDATE claim SET status = 'draft', submitted_at = NULL, updated_at = now() WHERE id = @id AND employee_id = @userId AND status = 'submitted'", new { id, userId = me.UserId });
            if (n == 0) throw ApiException.Conflict("not_withdrawable", "Only your own submitted claims can be withdrawn");
            await Event(conn, null, id, me.UserId, "withdrawn", null);
            return Results.Ok(await Detail(conn, await Load(conn, me, id)));
        }).RequireAuthorization(Policies.User);

        g.MapDelete("/{id:guid}", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var n = await conn.ExecuteAsync("DELETE FROM claim WHERE id = @id AND employee_id = @userId AND status IN ('draft','rejected')", new { id, userId = me.UserId });
            return n == 0 ? throw ApiException.Conflict("not_deletable", "Only your own draft or rejected claims can be deleted") : Results.NoContent();
        }).RequireAuthorization(Policies.User);
    }

    private static void Validate(ClaimInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title)) throw ApiException.Validation("Title is required");
        if (input.Amount <= 0) throw ApiException.Validation("Amount must be greater than zero");
        if (input.TaxAmount is < 0) throw ApiException.Validation("Tax cannot be negative");
        if (input.TaxAmount is { } t && t > input.Amount) throw ApiException.Validation("Tax cannot exceed the amount");
        if (input.Currency is { Length: not 3 }) throw ApiException.Validation("Currency must be a 3-letter code");
        foreach (var line in input.Lines ?? [])
            if (string.IsNullOrWhiteSpace(line.Description)) throw ApiException.Validation("Every line needs a description");
    }

    private static async Task SaveLines(NpgsqlConnection conn, NpgsqlTransaction tx, Guid claimId, List<LineInput>? lines)
    {
        var i = 0;
        foreach (var line in lines ?? [])
            await conn.ExecuteAsync("INSERT INTO claim_line(claim_id, sort_order, description, quantity, unit_price, amount) VALUES (@claimId, @i, @d, @q, @u, @a)",
                new { claimId, i = i++, d = line.Description.Trim(), q = line.Quantity ?? 1, u = line.UnitPrice, a = line.Amount }, tx);
    }

    private static async Task AttachReceipts(NpgsqlConnection conn, NpgsqlTransaction tx, Current me, Guid claimId, List<Guid>? receiptIds)
    {
        if (receiptIds is null || receiptIds.Count == 0) return;
        var n = await conn.ExecuteAsync(
            "UPDATE receipt SET claim_id = @claimId WHERE id = ANY(@ids) AND company_id = @companyId AND uploaded_by = @userId AND (claim_id IS NULL OR claim_id = @claimId)",
            new { claimId, ids = receiptIds.ToArray(), companyId = me.CompanyId, userId = me.UserId }, tx);
        if (n != receiptIds.Distinct().Count()) throw ApiException.Validation("One or more receipts are missing or belong to another claim");
    }

    public static async Task Submit(NpgsqlConnection conn, NpgsqlTransaction tx, Current me, Guid id)
    {
        var claim = await conn.QuerySingleAsync<ClaimRow>(ClaimSql + " WHERE c.id = @id", new { id }, tx);
        if (claim.Status is not ("draft" or "rejected")) throw ApiException.Conflict("not_submittable", $"A {claim.Status} claim cannot be submitted");
        var flags = await PolicyEngine.Evaluate(conn, me.CompanyId, claim.EmployeeId, id, claim.CategoryId, claim.Amount, claim.SpentOn, claim.ReceiptCount > 0, claim.Vendor);
        var blocking = flags.Where(f => f.Severity == "block").ToList();
        if (blocking.Count > 0) throw new ApiException(422, "policy_blocked", blocking[0].Message, new { flags });
        await conn.ExecuteAsync("UPDATE claim SET status = 'submitted', submitted_at = now(), policy_flags = @flags::jsonb, decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now() WHERE id = @id",
            new { id, flags = JsonSerializer.Serialize(flags, JsonOpts) }, tx);
        await Event(conn, tx, id, me.UserId, "submitted", flags.Count == 0 ? null : $"{flags.Count} policy flag(s)");
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public static Task Event(NpgsqlConnection conn, NpgsqlTransaction? tx, Guid claimId, Guid actorId, string action, string? note)
        => conn.ExecuteAsync("INSERT INTO claim_event(claim_id, actor_id, action, note) VALUES (@claimId, @actorId, @action, @note)", new { claimId, actorId, action, note }, tx);

    /// <summary>Loads a claim the caller may see: their own, their reports' (manager), or any (director/admin).</summary>
    public static async Task<ClaimRow> Load(NpgsqlConnection conn, Current me, Guid id, NpgsqlTransaction? tx = null)
    {
        var claim = await conn.QuerySingleOrDefaultAsync<ClaimRow>(ClaimSql + " WHERE c.id = @id AND c.company_id = @companyId", new { id, companyId = me.CompanyId }, tx)
            ?? throw ApiException.NotFound("Claim");
        if (claim.EmployeeId == me.UserId || me.SeesAllClaims) return claim;
        if (me.IsApprover && claim.ManagerId == me.UserId && claim.Status != "draft") return claim;
        throw ApiException.Forbidden();
    }

    public static async Task<object> Detail(NpgsqlConnection conn, ClaimRow claim)
    {
        var lines = await conn.QueryAsync<LineRow>("SELECT id, description, quantity, unit_price, amount FROM claim_line WHERE claim_id = @id ORDER BY sort_order", new { id = claim.Id });
        var receipts = await conn.QueryAsync<ReceiptEndpoints.ReceiptRow>(ReceiptEndpoints.ReceiptSql + " WHERE claim_id = @id ORDER BY created_at", new { id = claim.Id });
        var events = await conn.QueryAsync<EventRow>("SELECT ev.id, ev.action, ev.note, a.full_name AS actor_name, ev.created_at FROM claim_event ev LEFT JOIN app_user a ON a.id = ev.actor_id WHERE ev.claim_id = @id ORDER BY ev.created_at", new { id = claim.Id });
        return new
        {
            claim = Shape(claim),
            lines,
            receipts = receipts.Select(ReceiptEndpoints.Shape),
            events,
        };
    }
}
