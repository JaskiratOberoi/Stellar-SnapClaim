using Dapper;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;
using SnapClaim.Api.Services;

namespace SnapClaim.Api.Endpoints;

/// <summary>Read-only reference data every signed-in user needs: categories and the spending policy.</summary>
public static class CatalogueEndpoints
{
    public sealed class CategoryRow
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string Icon { get; set; } = "";
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
    }

    public sealed class PolicyRuleRow
    {
        public Guid Id { get; set; }
        public Guid? CategoryId { get; set; }
        public string? CategoryCode { get; set; }
        public string? CategoryName { get; set; }
        public decimal? MaxPerClaim { get; set; }
        public decimal? MaxPerMonth { get; set; }
        public decimal ReceiptRequiredAbove { get; set; }
        public int? MaxDaysToSubmit { get; set; }
        public string? Notes { get; set; }
    }

    public const string CategorySql = "SELECT id, code, name, icon, sort_order, is_active FROM category WHERE company_id = @companyId";
    public const string PolicySql = """
        SELECT r.id, r.category_id, c.code AS category_code, c.name AS category_name, r.max_per_claim, r.max_per_month,
               r.receipt_required_above, r.max_days_to_submit, r.notes
        FROM policy_rule r LEFT JOIN category c ON c.id = r.category_id
        WHERE r.company_id = @companyId
        ORDER BY r.category_id NULLS FIRST, c.sort_order
        """;

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/categories", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var rows = await conn.QueryAsync<CategoryRow>(CategorySql + " AND is_active ORDER BY sort_order, name", new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows });
        }).RequireAuthorization(Policies.User);

        api.MapGet("/policy", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var rows = await conn.QueryAsync<PolicyRuleRow>(PolicySql, new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows });
        }).RequireAuthorization(Policies.User);

        // Live compliance check while the employee fills the form.
        api.MapPost("/policy/check", async (PolicyEngine.CheckRequest req, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var flags = await PolicyEngine.Evaluate(conn, me.CompanyId, me.UserId, req.ClaimId, req.CategoryId, req.Amount, req.SpentOn, req.HasReceipt, req.Vendor);
            return Results.Ok(new { flags });
        }).RequireAuthorization(Policies.User);
    }
}
