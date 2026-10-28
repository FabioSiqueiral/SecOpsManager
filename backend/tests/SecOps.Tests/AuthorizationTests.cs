using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;
namespace SecOps.Tests;
public class AuthorizationTests
{
    [Fact] public async Task Anonymous_api_call_is_challenged() { await using var app = new WebApplicationFactory<Program>(); var response = await app.CreateClient().GetAsync("/api/catalog"); Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); }
    [Theory]
    [InlineData("Reader", "access_as_user")]
    [InlineData("Admin", "")]
    [InlineData("Unknown", "access_as_user")]
    public async Task Write_requires_both_role_and_delegated_scope(string role, string scope)
    {
        await using var app = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.ConfigureServices(s => s.AddAuthentication(o => { o.DefaultAuthenticateScheme = "Test"; o.DefaultChallengeScheme = "Test"; o.DefaultForbidScheme = "Test"; }).AddScheme<AuthenticationSchemeOptions, TestAuth>("Test", _ => { })));
        var client = app.CreateClient(); client.DefaultRequestHeaders.Add("Test-Role", role); client.DefaultRequestHeaders.Add("Test-Scope", scope); var response = await client.PostAsync("/api/activities", null); Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
    public class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync() { var id = new ClaimsIdentity(new[] { new Claim("oid", Request.Headers["Test-User"].FirstOrDefault() ?? Guid.NewGuid().ToString()), new Claim("name", "Teste HTTP"), new Claim("preferred_username", "http@example.test"), new Claim("roles", Request.Headers["Test-Role"].ToString()), new Claim("scp", Request.Headers["Test-Scope"].ToString()) }, "Test", "name", "roles"); return Task.FromResult(AuthenticateResult.Success(new(new ClaimsPrincipal(id), "Test"))); }
    }
}
