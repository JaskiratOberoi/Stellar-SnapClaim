using Dapper;
using Microsoft.AspNetCore.Identity;
using SnapClaim.Api.Data;

namespace SnapClaim.Api.Auth;

/// <summary>
/// Creates the company and the first admin when the user table is empty, so a
/// fresh deployment can be signed into without touching the database by hand.
/// With SNAPCLAIM_SEED_DEV=true also creates a director, a manager and two
/// employees reporting to that manager.
/// </summary>
public sealed class Bootstrap(Db db, SnapClaimOptions options, ILogger<Bootstrap> log)
{
    public static readonly PasswordHasher<object> Hasher = new();
    public static string Hash(string password) => Hasher.HashPassword(new object(), password);
    public static bool Verify(string hash, string password)
        => Hasher.VerifyHashedPassword(new object(), hash, password) != PasswordVerificationResult.Failed;

    public async Task RunAsync(CancellationToken ct)
    {
        await using var conn = await db.Open(ct);
        var users = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM app_user");
        if (users > 0) return;

        var companyId = await conn.ExecuteScalarAsync<Guid?>("SELECT id FROM company ORDER BY created_at LIMIT 1")
            ?? await conn.ExecuteScalarAsync<Guid>("INSERT INTO company(name) VALUES (@name) RETURNING id", new { name = options.BootstrapCompanyName });

        // A company created here (not by the seed) still needs categories and a default policy.
        if (await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM category WHERE company_id = @companyId", new { companyId }) == 0)
        {
            await conn.ExecuteAsync("""
                INSERT INTO category(company_id, code, name, icon, sort_order) VALUES
                  (@companyId, 'travel', 'Travel & tickets', 'airplane', 10),
                  (@companyId, 'fuel', 'Fuel & mileage', 'fuel', 20),
                  (@companyId, 'meals', 'Meals', 'restaurant', 30),
                  (@companyId, 'accommodation', 'Accommodation', 'hotel', 40),
                  (@companyId, 'supplies', 'Office supplies', 'cart', 50),
                  (@companyId, 'communication', 'Phone & internet', 'phone', 60),
                  (@companyId, 'software', 'Software & subscriptions', 'laptop', 70),
                  (@companyId, 'client', 'Client entertainment', 'people', 80),
                  (@companyId, 'other', 'Other', 'receipt', 90);
                INSERT INTO policy_rule(company_id, category_id, receipt_required_above, max_days_to_submit, notes)
                VALUES (@companyId, NULL, 500, 30, 'Default company policy');
                """, new { companyId });
        }

        async Task<Guid> Add(string email, string name, string role, string password, Guid? managerId = null, string? code = null, string? dept = null)
            => await conn.ExecuteScalarAsync<Guid>(
                "INSERT INTO app_user(company_id, email, full_name, employee_code, department, password_hash, role, manager_id) VALUES (@companyId, @email, @name, @code, @dept, @hash, @role::user_role, @managerId) RETURNING id",
                new { companyId, email, name, code, dept, hash = Hash(password), role, managerId });

        await Add(options.BootstrapAdminEmail, "Administrator", Roles.Admin, options.BootstrapAdminPassword, code: "ADM01", dept: "Administration");
        log.LogWarning("Bootstrapped admin {Email}. Change the password after first sign-in.", options.BootstrapAdminEmail);

        if (!options.SeedDev) return;
        var director = await Add("director@snapclaim.local", "Meera Director", Roles.Director, "Director123!", code: "DIR01", dept: "Finance");
        var manager = await Add("manager@snapclaim.local", "Priya Manager", Roles.Manager, "Manager123!", director, "MGR01", "Sales");
        await Add("ravi@snapclaim.local", "Ravi Kumar", Roles.Employee, "Employee123!", manager, "EMP01", "Sales");
        await Add("anita@snapclaim.local", "Anita Sharma", Roles.Employee, "Employee123!", manager, "EMP02", "Sales");
        log.LogWarning("Dev users seeded: director@ / manager@ / ravi@ / anita@snapclaim.local");
    }
}
