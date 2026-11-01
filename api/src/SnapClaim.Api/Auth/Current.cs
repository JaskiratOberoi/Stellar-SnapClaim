using System.Security.Claims;

namespace SnapClaim.Api.Auth;

/// <summary>The caller of the current request, read from JWT claims.</summary>
public sealed class Current
{
    public Guid UserId { get; }
    public Guid CompanyId { get; }
    public string Role { get; }
    public string Name { get; }

    public bool IsAdmin => Role == Roles.Admin;
    public bool IsDirector => Role is Roles.Admin or Roles.Director;
    public bool IsApprover => Role is Roles.Admin or Roles.Director or Roles.Manager;
    /// <summary>Directors and admins see every claim in the company; managers only their reports'.</summary>
    public bool SeesAllClaims => IsDirector;

    private Current(ClaimsPrincipal p)
    {
        UserId = Guid.Parse(p.FindFirstValue("sub") ?? throw ApiException.Forbidden("Not signed in"));
        CompanyId = Guid.Parse(p.FindFirstValue("co") ?? throw ApiException.Forbidden("Not signed in"));
        Role = p.FindFirstValue("role") ?? Roles.Employee;
        Name = p.FindFirstValue("name") ?? "";
    }

    public static Current From(ClaimsPrincipal p) => new(p);

    public void RequireApprover() { if (!IsApprover) throw ApiException.Forbidden("Requires manager, director or admin"); }
    public void RequireDirector() { if (!IsDirector) throw ApiException.Forbidden("Requires director or admin"); }
    public void RequireAdmin() { if (!IsAdmin) throw ApiException.Forbidden("Requires admin"); }
}
