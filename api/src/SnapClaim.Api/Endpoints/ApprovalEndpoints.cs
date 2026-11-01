using Dapper;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;

namespace SnapClaim.Api.Endpoints;

/// <summary>One-tap manager approval: the queue of submitted claims and batch decisions.</summary>
public static class ApprovalEndpoints
{
    public sealed record DecideRequest(List<Guid> ClaimIds, string Decision, string? Note);

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/approvals").RequireAuthorization(Policies.Approver);

        // Pending queue: a manager sees their reports; directors and admins see the company.
        g.MapGet("/", async (HttpContext http, Db db, string? period, Guid? employeeId) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var where = "WHERE c.company_id = @companyId AND c.status = 'submitted'" + (me.SeesAllClaims ? "" : " AND e.manager_id = @userId")
                + (period is null ? "" : " AND c.period = @period") + (employeeId is null ? "" : " AND c.employee_id = @employeeId");
            var rows = await conn.QueryAsync<ClaimEndpoints.ClaimRow>(ClaimEndpoints.ClaimSql + " " + where + " ORDER BY c.submitted_at", new { companyId = me.CompanyId, userId = me.UserId, period, employeeId });
            var list = rows.ToList();
            return Results.Ok(new
            {
                items = list.Select(ClaimEndpoints.Shape),
                total = list.Count,
                total_amount = list.Sum(c => c.Amount),
                flagged = list.Count(c => c.PolicyFlags != "[]"),
            });
        });

        g.MapPost("/decide", async (DecideRequest req, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            if (req.ClaimIds is null || req.ClaimIds.Count == 0) throw ApiException.Validation("claim_ids required");
            if (req.Decision is not ("approve" or "reject")) throw ApiException.Validation("decision must be approve or reject");
            if (req.Decision == "reject" && string.IsNullOrWhiteSpace(req.Note)) throw ApiException.Validation("A note is required when rejecting");

            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var decided = new List<Guid>();
            var skipped = new List<object>();
            foreach (var id in req.ClaimIds.Distinct())
            {
                var claim = await conn.QuerySingleOrDefaultAsync<ClaimEndpoints.ClaimRow>(ClaimEndpoints.ClaimSql + " WHERE c.id = @id AND c.company_id = @companyId FOR UPDATE OF c", new { id, companyId = me.CompanyId }, tx);
                if (claim is null) { skipped.Add(new { id, reason = "not_found" }); continue; }
                if (claim.Status != "submitted") { skipped.Add(new { id, reason = $"status_{claim.Status}" }); continue; }
                if (!me.SeesAllClaims && claim.ManagerId != me.UserId) { skipped.Add(new { id, reason = "not_your_report" }); continue; }
                if (claim.EmployeeId == me.UserId) { skipped.Add(new { id, reason = "own_claim" }); continue; }
                var status = req.Decision == "approve" ? "approved" : "rejected";
                await conn.ExecuteAsync("UPDATE claim SET status = @status::claim_status, decided_by = @userId, decided_at = now(), decision_note = @note, updated_at = now() WHERE id = @id",
                    new { id, status, userId = me.UserId, note = req.Note?.Trim() }, tx);
                await ClaimEndpoints.Event(conn, tx, id, me.UserId, status, req.Note?.Trim());
                decided.Add(id);
            }
            await tx.CommitAsync();
            return Results.Ok(new { decided, skipped });
        });
    }
}
