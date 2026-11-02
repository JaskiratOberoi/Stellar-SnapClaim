using System.Text.Json;
using Dapper;
using Npgsql;
using SnapClaim.Api.Auth;

namespace SnapClaim.Api.Services;

/// <summary>
/// The company-wide audit trail: one row per action anyone takes, written in the
/// same transaction as the action where there is one. claim_event stays as the
/// per-claim history the claimant sees.
/// </summary>
public static class Audit
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public static Task Log(NpgsqlConnection conn, NpgsqlTransaction? tx, HttpContext? http, Current me, string action, string? entityType, object? entityId, string summary, object? details = null)
        => Log(conn, tx, http, me.CompanyId, me.UserId, me.Name, action, entityType, entityId, summary, details);

    public static Task Log(NpgsqlConnection conn, NpgsqlTransaction? tx, HttpContext? http, Guid companyId, Guid? actorId, string actorName, string action, string? entityType, object? entityId, string summary, object? details = null)
        => conn.ExecuteAsync("""
            INSERT INTO audit_log(company_id, actor_id, actor_name, action, entity_type, entity_id, summary, details, ip, user_agent)
            VALUES (@companyId, @actorId, @actorName, @action, @entityType, @entityId, @summary, @details::jsonb, @ip, @ua)
            """,
            new
            {
                companyId, actorId, actorName, action, entityType,
                entityId = entityId?.ToString(),
                summary,
                details = JsonSerializer.Serialize(details ?? new { }, JsonOpts),
                ip = Ip(http),
                ua = Agent(http),
            }, tx);

    private static string? Ip(HttpContext? http)
    {
        if (http is null) return null;
        var h = http.Request.Headers;
        if (h.TryGetValue("CF-Connecting-IP", out var cf) && !string.IsNullOrWhiteSpace(cf)) return cf.ToString();
        if (h.TryGetValue("X-Forwarded-For", out var xf) && !string.IsNullOrWhiteSpace(xf)) return xf.ToString().Split(',')[0].Trim();
        return http.Connection.RemoteIpAddress?.ToString();
    }

    private static string? Agent(HttpContext? http)
    {
        var ua = http?.Request.Headers.UserAgent.ToString();
        return string.IsNullOrEmpty(ua) ? null : ua[..Math.Min(200, ua.Length)];
    }
}
