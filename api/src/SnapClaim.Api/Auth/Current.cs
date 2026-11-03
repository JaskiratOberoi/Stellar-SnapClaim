using System.Security.Claims;

namespace SnapClaim.Api.Auth;

/// <summary>The caller of the current request, read from JWT claims.</summary>
public sealed class Current
{
    public Guid UserId { get; }
    public Guid CompanyId { get; }
    public string Role { get; }
    public string Name { get; }

    public bool IsSuperAdmin => Role == Roles.SuperAdmin;
    /// <summary>Admins and super admins: they see every claim and run month-end.</summary>
    public bool IsReviewer => Role is Roles.SuperAdmin or Roles.Admin;
    public bool IsApprover => Role is Roles.SuperAdmin or Roles.Admin or Roles.Approver;
    public bool SeesAllClaims => IsReviewer;
    /// <summary>Only the super admin decides on any claim; admins and approvers decide on their direct reports'.</summary>
    public bool DecidesAll => IsSuperAdmin;

    private Current(ClaimsPrincipal p)
    {
        UserId = Guid.Parse(p.FindFirstValue("sub") ?? throw ApiException.Forbidden("Not signed in"));
        CompanyId = Guid.Parse(p.FindFirstValue("co") ?? throw ApiException.Forbidden("Not signed in"));
        Role = p.FindFirstValue("role") ?? Roles.Employee;
        Name = p.FindFirstValue("name") ?? "";
    }

    public static Current From(ClaimsPrincipal p) => new(p);

    /// <summary>May this caller approve, reject or edit a submitted claim of the given employee?</summary>
    public bool MayDecide(Guid employeeId, Guid? managerId) => employeeId != UserId && (DecidesAll || (IsApprover && managerId == UserId));

    /// <summary>Roles this caller may hand out or alter: the super admin any; an admin only employee and approver.</summary>
    public bool MayAssign(string role) => IsSuperAdmin || (IsReviewer && role is Roles.Employee or Roles.Approver);
    public void RequireMayAssign(string role) { if (!MayAssign(role)) throw ApiException.Forbidden("Only a super admin can make someone an admin or super admin"); }
    public void RequireMayManage(string role) { if (!MayAssign(role)) throw ApiException.Forbidden("Only a super admin can change an admin or super admin"); }

    public void RequireApprover() { if (!IsApprover) throw ApiException.Forbidden("Requires approver, admin or super admin"); }
    public void RequireReviewer() { if (!IsReviewer) throw ApiException.Forbidden("Requires admin or super admin"); }
    public void RequireSuperAdmin() { if (!IsSuperAdmin) throw ApiException.Forbidden("Requires super admin"); }
}
