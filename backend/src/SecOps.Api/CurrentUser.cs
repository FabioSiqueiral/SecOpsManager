using SecOps.Application;
namespace SecOps.Api;
public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid Id => Guid.Parse(accessor.HttpContext!.User.FindFirst("oid")!.Value);
    public string Name => accessor.HttpContext!.User.FindFirst("name")?.Value ?? "Usuário";
    public string Email => accessor.HttpContext!.User.FindFirst("preferred_username")?.Value ?? "";
}
