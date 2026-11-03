namespace SnapClaim.Api.Auth;

/// <summary>
/// Roles as capability sets. A user has exactly one role.
/// Keep in step with the user_role enum in db/sql/002_roles_and_audit.sql.
///
///   super_admin  everything, including people, the policy and the audit trail
///   admin        sees every claim; approves, rejects and edits its direct reports' claims; month-end; audit trail;
///                onboards and looks after employees and approvers (never admins or super admins)
///   approver     approves, rejects and edits its direct reports' submitted claims; files its own
///   employee     files its own claims and may withdraw one before it is decided
/// </summary>
public static class Roles
{
    public const string SuperAdmin = "super_admin";
    public const string Admin = "admin";
    public const string Approver = "approver";
    public const string Employee = "employee";

    public static readonly string[] All = [SuperAdmin, Admin, Approver, Employee];

    /// <summary>Capability names the app uses to shape navigation. Never trusted for authorization.</summary>
    public static string[] Capabilities(string role) => role switch
    {
        SuperAdmin => ["claims.file", "claims.approve", "claims.approve_all", "claims.see_all", "months.review", "months.close", "users", "users.admins", "policy", "audit"],
        Admin      => ["claims.file", "claims.approve", "claims.see_all", "months.review", "months.close", "users", "audit"],
        Approver   => ["claims.file", "claims.approve"],
        _          => ["claims.file"],
    };
}

public static class Policies
{
    public const string User = "user";
    public const string Approver = "approver";       // approver, admin, super_admin
    public const string Reviewer = "reviewer";       // admin, super_admin: month-end and the audit trail
    public const string SuperAdmin = "super_admin";  // policy, categories, and the admin/super-admin accounts
}
