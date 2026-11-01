using Dapper;
using Npgsql;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;

namespace SnapClaim.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record LoginRequest(string Email, string Password);
    public sealed record RefreshRequest(string RefreshToken);
    public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    public sealed class UserRow
    {
        public Guid Id { get; set; }
        public Guid CompanyId { get; set; }
        public string Email { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? EmployeeCode { get; set; }
        public string? Department { get; set; }
        public string Role { get; set; } = "";
        public Guid? ManagerId { get; set; }
        public string? ManagerName { get; set; }
        public bool IsActive { get; set; }
        public int SessionVersion { get; set; }
        public string PasswordHash { get; set; } = "";
        public string CompanyName { get; set; } = "";
        public string Currency { get; set; } = "INR";
        public string Timezone { get; set; } = "Asia/Kolkata";
    }

    public const string UserSql = """
        SELECT u.id, u.company_id, u.email::text AS email, u.full_name, u.employee_code, u.department, u.role::text AS role,
               u.manager_id, m.full_name AS manager_name, u.is_active, u.session_version, u.password_hash,
               c.name AS company_name, c.currency, c.timezone
        FROM app_user u
        JOIN company c ON c.id = u.company_id
        LEFT JOIN app_user m ON m.id = u.manager_id
        """;

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/auth");

        g.MapPost("/login", async (LoginRequest req, Db db, JwtIssuer jwt, SnapClaimOptions opt) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                throw ApiException.Validation("Email and password are required");
            await using var conn = await db.Open();
            var user = await conn.QuerySingleOrDefaultAsync<UserRow>(UserSql + " WHERE u.email = @email", new { email = req.Email.Trim() });
            if (user is null || !user.IsActive || !Bootstrap.Verify(user.PasswordHash, req.Password))
            {
                await Task.Delay(Random.Shared.Next(150, 400));
                throw new ApiException(401, "invalid_credentials", "Email or password is incorrect");
            }
            await conn.ExecuteAsync("UPDATE app_user SET last_login_at = now() WHERE id = @Id", new { user.Id });
            return Results.Ok(await Session(conn, user, jwt, opt));
        }).AllowAnonymous();

        g.MapPost("/refresh", async (RefreshRequest req, Db db, JwtIssuer jwt, SnapClaimOptions opt) =>
        {
            if (string.IsNullOrWhiteSpace(req.RefreshToken)) throw ApiException.Validation("refresh_token required");
            await using var conn = await db.Open();
            await using var tx = await conn.BeginTransactionAsync();
            var hash = JwtIssuer.Sha256(req.RefreshToken);
            var row = await conn.QuerySingleOrDefaultAsync<(Guid id, Guid user_id, DateTime expires_at, DateTime? revoked_at)>(
                "SELECT id, user_id, expires_at, revoked_at FROM refresh_token WHERE token_hash = @hash FOR UPDATE", new { hash }, tx);
            if (row.id == Guid.Empty || row.revoked_at is not null || row.expires_at < DateTime.UtcNow)
                throw new ApiException(401, "invalid_refresh", "Refresh token is invalid or expired");
            var user = await conn.QuerySingleOrDefaultAsync<UserRow>(UserSql + " WHERE u.id = @id", new { id = row.user_id }, tx);
            if (user is null || !user.IsActive) throw new ApiException(401, "invalid_refresh", "User is inactive");
            await conn.ExecuteAsync("UPDATE refresh_token SET revoked_at = now() WHERE id = @id", new { row.id }, tx);
            var session = await Session(conn, user, jwt, opt, tx);
            await tx.CommitAsync();
            return Results.Ok(session);
        }).AllowAnonymous();

        g.MapPost("/logout", async (RefreshRequest req, Db db) =>
        {
            await using var conn = await db.Open();
            await conn.ExecuteAsync("UPDATE refresh_token SET revoked_at = now() WHERE token_hash = @hash AND revoked_at IS NULL",
                new { hash = JwtIssuer.Sha256(req.RefreshToken ?? "") });
            return Results.NoContent();
        }).AllowAnonymous();

        g.MapPost("/logout-all", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            await conn.ExecuteAsync("UPDATE refresh_token SET revoked_at = now() WHERE user_id = @id AND revoked_at IS NULL; UPDATE app_user SET session_version = session_version + 1 WHERE id = @id",
                new { id = me.UserId });
            return Results.NoContent();
        }).RequireAuthorization(Policies.User);

        g.MapGet("/me", async (HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var user = await conn.QuerySingleAsync<UserRow>(UserSql + " WHERE u.id = @id", new { id = me.UserId });
            return Results.Ok(new { user = Profile(user), company = Company(user) });
        }).RequireAuthorization(Policies.User);

        g.MapPost("/change-password", async (ChangePasswordRequest req, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
                throw ApiException.Validation("New password must be at least 8 characters");
            await using var conn = await db.Open();
            var hash = await conn.ExecuteScalarAsync<string>("SELECT password_hash FROM app_user WHERE id = @id", new { id = me.UserId });
            if (hash is null || !Bootstrap.Verify(hash, req.CurrentPassword)) throw new ApiException(400, "wrong_password", "Current password is incorrect");
            await conn.ExecuteAsync("UPDATE app_user SET password_hash = @hash, updated_at = now() WHERE id = @id", new { hash = Bootstrap.Hash(req.NewPassword), id = me.UserId });
            return Results.NoContent();
        }).RequireAuthorization(Policies.User);
    }

    private static async Task<object> Session(NpgsqlConnection conn, UserRow user, JwtIssuer jwt, SnapClaimOptions opt, NpgsqlTransaction? tx = null)
    {
        var (access, expires) = jwt.IssueAccess(user.Id, user.CompanyId, user.Role, user.FullName, user.SessionVersion);
        var refresh = JwtIssuer.NewRefreshToken();
        await conn.ExecuteAsync(
            "INSERT INTO refresh_token(user_id, token_hash, expires_at) VALUES (@uid, @hash, @exp)",
            new { uid = user.Id, hash = JwtIssuer.Sha256(refresh), exp = DateTime.UtcNow.AddDays(opt.RefreshTokenDays) }, tx);
        return new { access_token = access, refresh_token = refresh, expires_in = expires, user = Profile(user), company = Company(user) };
    }

    public static object Profile(UserRow u) => new
    {
        id = u.Id, email = u.Email, full_name = u.FullName, employee_code = u.EmployeeCode, department = u.Department,
        role = u.Role, manager_id = u.ManagerId, manager_name = u.ManagerName, is_active = u.IsActive,
        capabilities = Roles.Capabilities(u.Role),
    };

    public static object Company(UserRow u) => new { id = u.CompanyId, name = u.CompanyName, currency = u.Currency, timezone = u.Timezone };
}
