using System.Text.RegularExpressions;
using Dapper;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;
using SnapClaim.Api.Services;

namespace SnapClaim.Api.Endpoints;

/// <summary>Director's month-end: summary, Excel export, and the close that clears approved claims.</summary>
public static partial class ReportEndpoints
{
    public sealed record CloseRequest(string? Note);

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex PeriodPattern();

    public sealed class MonthRow
    {
        public string Period { get; set; } = "";
        public int Claims { get; set; }
        public int Submitted { get; set; }
        public int Approved { get; set; }
        public int Rejected { get; set; }
        public int Cleared { get; set; }
        public decimal ApprovedAmount { get; set; }
        public decimal ClearedAmount { get; set; }
        public decimal PendingAmount { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? ClosedByName { get; set; }
    }

    private const string MonthSql = """
        SELECT p.period,
               count(c.id)::int AS claims,
               count(c.id) FILTER (WHERE c.status = 'submitted')::int AS submitted,
               count(c.id) FILTER (WHERE c.status = 'approved')::int AS approved,
               count(c.id) FILTER (WHERE c.status = 'rejected')::int AS rejected,
               count(c.id) FILTER (WHERE c.status = 'cleared')::int AS cleared,
               coalesce(sum(c.amount) FILTER (WHERE c.status = 'approved'), 0) AS approved_amount,
               coalesce(sum(c.amount) FILTER (WHERE c.status = 'cleared'), 0) AS cleared_amount,
               coalesce(sum(c.amount) FILTER (WHERE c.status = 'submitted'), 0) AS pending_amount,
               mc.closed_at, u.full_name AS closed_by_name
        FROM (SELECT DISTINCT period FROM claim WHERE company_id = @companyId AND status <> 'draft'
              UNION SELECT period FROM month_close WHERE company_id = @companyId) p
        LEFT JOIN claim c ON c.company_id = @companyId AND c.period = p.period AND c.status <> 'draft'
        LEFT JOIN month_close mc ON mc.company_id = @companyId AND mc.period = p.period
        LEFT JOIN app_user u ON u.id = mc.closed_by
        """;

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/months").RequireAuthorization(Policies.Reviewer);

        g.MapGet("/", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var rows = await conn.QueryAsync<MonthRow>(MonthSql + " GROUP BY p.period, mc.closed_at, u.full_name ORDER BY p.period DESC", new { companyId = me.CompanyId });
            return Results.Ok(new { items = rows });
        });

        g.MapGet("/{period}", async (string period, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            CheckPeriod(period);
            await using var conn = await db.Open();
            var month = await conn.QuerySingleOrDefaultAsync<MonthRow>(MonthSql + " WHERE p.period = @period GROUP BY p.period, mc.closed_at, u.full_name", new { companyId = me.CompanyId, period })
                ?? new MonthRow { Period = period };
            var byEmployee = await conn.QueryAsync("""
                SELECT e.id AS employee_id, e.full_name, e.employee_code, e.department, m.full_name AS manager_name,
                       count(*)::int AS claims,
                       count(*) FILTER (WHERE c.status = 'submitted')::int AS pending,
                       coalesce(sum(c.amount) FILTER (WHERE c.status IN ('approved','cleared')), 0) AS approved_amount,
                       coalesce(sum(c.amount) FILTER (WHERE c.status = 'submitted'), 0) AS pending_amount,
                       coalesce(sum(c.amount) FILTER (WHERE c.status = 'rejected'), 0) AS rejected_amount
                FROM claim c JOIN app_user e ON e.id = c.employee_id LEFT JOIN app_user m ON m.id = e.manager_id
                WHERE c.company_id = @companyId AND c.period = @period AND c.status <> 'draft'
                GROUP BY e.id, e.full_name, e.employee_code, e.department, m.full_name ORDER BY approved_amount DESC
                """, new { companyId = me.CompanyId, period });
            var byCategory = await conn.QueryAsync("""
                SELECT coalesce(k.name, 'Uncategorised') AS category, count(*)::int AS claims,
                       coalesce(sum(c.amount) FILTER (WHERE c.status IN ('approved','cleared')), 0) AS approved_amount,
                       coalesce(sum(c.amount) FILTER (WHERE c.status = 'submitted'), 0) AS pending_amount
                FROM claim c LEFT JOIN category k ON k.id = c.category_id
                WHERE c.company_id = @companyId AND c.period = @period AND c.status <> 'draft'
                GROUP BY k.name ORDER BY approved_amount DESC
                """, new { companyId = me.CompanyId, period });
            var flagged = await conn.QueryAsync<ClaimEndpoints.ClaimRow>(ClaimEndpoints.ClaimSql + " WHERE c.company_id = @companyId AND c.period = @period AND c.status <> 'draft' AND c.policy_flags <> '[]'::jsonb ORDER BY c.amount DESC", new { companyId = me.CompanyId, period });
            return Results.Ok(new { month, by_employee = byEmployee, by_category = byCategory, flagged = flagged.Select(ClaimEndpoints.Shape) });
        });

        g.MapGet("/{period}/export.xlsx", async (string period, HttpContext http, Db db, ExcelExporter exporter) =>
        {
            var me = Current.From(http.User);
            CheckPeriod(period);
            await using var conn = await db.Open();
            var bytes = await exporter.MonthWorkbook(conn, me.CompanyId, period, me.Name);
            var company = await conn.ExecuteScalarAsync<string>("SELECT name FROM company WHERE id = @id", new { id = me.CompanyId }) ?? "SnapClaim";
            var safe = Regex.Replace(company, @"[^A-Za-z0-9]+", "-").Trim('-');
            await Audit.Log(conn, null, http, me, "month.export", "month", period, $"Exported the {period} workbook");
            return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"SnapClaim-{safe}-{period}.xlsx");
        });

        // Director's approval of the month: every approved claim becomes cleared. Idempotent; pending claims are left alone and reported.
        g.MapPost("/{period}/close", async (string period, CloseRequest? req, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            CheckPeriod(period);
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var ids = (await conn.QueryAsync<Guid>("SELECT id FROM claim WHERE company_id = @companyId AND period = @period AND status = 'approved' FOR UPDATE", new { companyId = me.CompanyId, period }, tx)).ToList();
            foreach (var id in ids)
            {
                await conn.ExecuteAsync("UPDATE claim SET status = 'cleared', cleared_by = @userId, cleared_at = now(), updated_at = now() WHERE id = @id", new { id, userId = me.UserId }, tx);
                await ClaimEndpoints.Event(conn, tx, id, me.UserId, "cleared", req?.Note?.Trim());
            }
            var totals = await conn.QuerySingleAsync<(int n, decimal amount)>("SELECT count(*)::int, coalesce(sum(amount), 0) FROM claim WHERE company_id = @companyId AND period = @period AND status = 'cleared'", new { companyId = me.CompanyId, period }, tx);
            var pending = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM claim WHERE company_id = @companyId AND period = @period AND status = 'submitted'", new { companyId = me.CompanyId, period }, tx);
            await conn.ExecuteAsync("""
                INSERT INTO month_close(company_id, period, closed_by, claim_count, total_amount, note) VALUES (@companyId, @period, @userId, @n, @amount, @note)
                ON CONFLICT (company_id, period) DO UPDATE SET closed_by = EXCLUDED.closed_by, closed_at = now(), claim_count = EXCLUDED.claim_count, total_amount = EXCLUDED.total_amount, note = coalesce(EXCLUDED.note, month_close.note)
                """, new { companyId = me.CompanyId, period, userId = me.UserId, totals.n, totals.amount, note = req?.Note?.Trim() }, tx);
            await Audit.Log(conn, tx, http, me, "month.close", "month", period, $"Closed {period}: cleared {ids.Count} approved claim(s)", new { newly_cleared = ids.Count, still_pending = pending, note = req?.Note?.Trim() });
            await tx.CommitAsync();
            return Results.Ok(new { period, newly_cleared = ids.Count, cleared_total = totals.n, cleared_amount = totals.amount, still_pending = pending });
        });
    }

    private static void CheckPeriod(string period)
    {
        if (!PeriodPattern().IsMatch(period)) throw ApiException.Validation("period must be YYYY-MM");
    }
}
