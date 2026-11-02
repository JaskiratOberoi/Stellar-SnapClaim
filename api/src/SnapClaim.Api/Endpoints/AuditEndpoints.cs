using Dapper;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;

namespace SnapClaim.Api.Endpoints;

/// <summary>The audit trail, newest first, for admins and the super admin.</summary>
public static class AuditEndpoints
{
    public sealed record Entry(long Id, Guid? ActorId, string ActorName, string Action, string? EntityType, string? EntityId, string Summary, string Details, string? Ip, DateTime CreatedAt);

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/audit").RequireAuthorization(Policies.Reviewer);

        // ?prefix=claim.   ?actor_id=   ?q=   ?limit=50&offset=0
        g.MapGet("/", async (HttpContext http, Db db, string? prefix, Guid? actorId, string? q, int? limit, int? offset) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var where = new List<string> { "company_id = @companyId" };
            if (!string.IsNullOrWhiteSpace(prefix)) where.Add("action LIKE @prefix || '%'");
            if (actorId is not null) where.Add("actor_id = @actorId");
            if (!string.IsNullOrWhiteSpace(q)) where.Add("(summary ILIKE '%' || @q || '%' OR actor_name ILIKE '%' || @q || '%' OR entity_id = @q)");
            var w = "WHERE " + string.Join(" AND ", where);
            var take = Math.Clamp(limit ?? 50, 1, 200);
            var skip = Math.Max(0, offset ?? 0);
            var args = new { companyId = me.CompanyId, prefix = prefix?.Trim(), actorId, q = q?.Trim(), take, skip };
            var total = await conn.ExecuteScalarAsync<int>($"SELECT count(*) FROM audit_log {w}", args);
            var rows = await conn.QueryAsync<Entry>($"""
                SELECT id, actor_id, actor_name, action, entity_type, entity_id, summary, details::text AS details, ip, created_at
                FROM audit_log {w} ORDER BY created_at DESC, id DESC LIMIT @take OFFSET @skip
                """, args);
            return Results.Ok(new
            {
                items = rows.Select(r => new
                {
                    id = r.Id, actor_id = r.ActorId, actor_name = r.ActorName, action = r.Action, entity_type = r.EntityType, entity_id = r.EntityId,
                    summary = r.Summary, details = System.Text.Json.JsonDocument.Parse(r.Details).RootElement, ip = r.Ip, created_at = r.CreatedAt,
                }),
                total,
            });
        });
    }
}
