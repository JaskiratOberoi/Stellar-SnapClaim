namespace SnapClaim.Api.Auth;

/// <summary>
/// Roles as capability sets. A user has exactly one role.
/// Keep in step with the user_role enum in db/sql/001_schema.sql.
/// </summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string Director = "director";
    public const string Manager = "manager";
    public const string Employee = "employee";

    public static readonly string[] All = [Admin, Director, Manager, Employee];

    /// <summary>Capability names the app uses to shape navigation. Never trusted for authorization.</summary>
    public static string[] Capabilities(string role) => role switch
    {
        Admin    => ["claims.file", "claims.approve", "claims.approve_all", "months.review", "months.close", "users", "policy"],
        Director => ["claims.file", "claims.approve", "claims.approve_all", "months.review", "months.close"],
        Manager  => ["claims.file", "claims.approve"],
        _        => ["claims.file"],
    };
}

public static class Policies
{
    public const string User = "user";
    public const string Approver = "approver";   // manager, director, admin
    public const string Director = "director";   // director, admin
    public const string Admin = "admin";
}
