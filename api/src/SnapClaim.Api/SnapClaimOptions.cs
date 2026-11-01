using System.Text;

namespace SnapClaim.Api;

/// <summary>
/// Every runtime setting, read once from SNAPCLAIM_* environment variables.
/// Validated at startup so a half-configured deployment fails the deploy
/// rather than the first request.
/// </summary>
public sealed class SnapClaimOptions
{
    public required string DbConnection { get; init; }
    public required byte[] JwtKey { get; init; }
    public required string JwtIssuer { get; init; }
    public int AccessTokenMinutes { get; init; } = 30;
    public int RefreshTokenDays { get; init; } = 30;
    public string[] CorsOrigins { get; init; } = [];
    public string SqlDir { get; init; } = "";
    public string SeedDir { get; init; } = "";
    public bool SeedDev { get; init; }
    public string BootstrapAdminEmail { get; init; } = "admin@snapclaim.local";
    public string BootstrapAdminPassword { get; init; } = "ChangeMe123!";
    public string BootstrapCompanyName { get; init; } = "My Company";
    /// <summary>Company API key for receipt extraction. Empty = extraction skipped, manual entry only.</summary>
    public string AnthropicApiKey { get; init; } = "";
    public string ClaudeModel { get; init; } = "claude-opus-5-5";
    public int MaxReceiptBytes { get; init; } = 8 * 1024 * 1024;

    public static SnapClaimOptions From(IConfiguration c)
    {
        string Get(string key, string? fallback = null)
            => c[key] ?? fallback ?? throw new InvalidOperationException($"{key} is not set");

        var key = Get("SNAPCLAIM_JWT_SIGNING_KEY");
        byte[] keyBytes;
        try { keyBytes = Convert.FromBase64String(key); }
        catch { keyBytes = Encoding.UTF8.GetBytes(key); }
        if (keyBytes.Length < 32)
            throw new InvalidOperationException("SNAPCLAIM_JWT_SIGNING_KEY must be at least 32 bytes");

        var baseDir = AppContext.BaseDirectory;
        return new SnapClaimOptions
        {
            DbConnection = Get("SNAPCLAIM_DB_CONNECTION"),
            JwtKey = keyBytes,
            JwtIssuer = Get("SNAPCLAIM_JWT_ISSUER", "snapclaim-api"),
            AccessTokenMinutes = int.TryParse(c["SNAPCLAIM_ACCESS_TOKEN_MINUTES"], out var am) ? am : 30,
            RefreshTokenDays = int.TryParse(c["SNAPCLAIM_REFRESH_TOKEN_DAYS"], out var rd) ? rd : 30,
            CorsOrigins = (c["SNAPCLAIM_CORS_ORIGINS"] ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            SqlDir = c["SNAPCLAIM_SQL_DIR"] ?? Path.Combine(baseDir, "db", "sql"),
            SeedDir = c["SNAPCLAIM_SEED_DIR"] ?? Path.Combine(baseDir, "db", "seed"),
            SeedDev = string.Equals(c["SNAPCLAIM_SEED_DEV"], "true", StringComparison.OrdinalIgnoreCase),
            BootstrapAdminEmail = c["SNAPCLAIM_BOOTSTRAP_ADMIN_EMAIL"] ?? "admin@snapclaim.local",
            BootstrapAdminPassword = c["SNAPCLAIM_BOOTSTRAP_ADMIN_PASSWORD"] ?? "ChangeMe123!",
            BootstrapCompanyName = c["SNAPCLAIM_COMPANY_NAME"] ?? "My Company",
            AnthropicApiKey = c["ANTHROPIC_API_KEY"] ?? "",
            ClaudeModel = c["SNAPCLAIM_CLAUDE_MODEL"] ?? "claude-opus-5-5",
            MaxReceiptBytes = int.TryParse(c["SNAPCLAIM_MAX_RECEIPT_BYTES"], out var mb) ? mb : 8 * 1024 * 1024,
        };
    }
}
