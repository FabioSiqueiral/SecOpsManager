using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SecOps.Infrastructure;
using Xunit;
namespace SecOps.Tests;
public class ApiIntegrationTests
{
    [Fact, Trait("Category", "Integration")]
    public async Task Authorized_HTTP_workflow_and_reports()
    {
        var configured = Environment.GetEnvironmentVariable("SECOPS_TEST_SQL"); Assert.False(string.IsNullOrWhiteSpace(configured));
        var connection = new SqlConnectionStringBuilder(configured) { InitialCatalog = "SecOpsManager_ApiTests_" + Guid.NewGuid().ToString("N") };
        await using var app = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development").ConfigureServices(s =>
        {
            s.RemoveAll<DbContextOptions<SecOpsDbContext>>(); s.AddDbContext<SecOpsDbContext>(o => o.UseSqlServer(connection.ConnectionString));
            s.AddAuthentication(o => { o.DefaultAuthenticateScheme = "Test"; o.DefaultChallengeScheme = "Test"; o.DefaultForbidScheme = "Test"; }).AddScheme<AuthenticationSchemeOptions, AuthorizationTests.TestAuth>("Test", _ => { });
        }));
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SecOpsDbContext>();
        try
        {
            await db.Database.MigrateAsync(); var client = app.CreateClient(); client.DefaultRequestHeaders.Add("Test-Role", "Admin"); client.DefaultRequestHeaders.Add("Test-Scope", "access_as_user"); client.DefaultRequestHeaders.Add("Test-User", Guid.NewGuid().ToString());
            async Task<JsonElement> Ok(HttpResponseMessage r) { var text = await r.Content.ReadAsStringAsync(); Assert.True(r.IsSuccessStatusCode, $"{r.StatusCode}: {text}"); return text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text); }
            await Ok(await client.PostAsync("/api/session/login", null));
            var created = await Ok(await client.PostAsJsonAsync("/api/activities", new { title = "Assessment HTTP", description = "Integração", categoryId = "10000000-0000-0000-0000-000000000001", subcategory = "Assessment", priority = "High", severity = "Normal", team = "QA", dueAt = DateTimeOffset.UtcNow.AddDays(1), slaAt = DateTimeOffset.UtcNow.AddDays(2), estimatedHours = 2, blocked = false }));
            var id = created.GetProperty("id").GetString();
            await Ok(await client.PostAsync($"/api/activities/{id}/timer/start", null)); await Ok(await client.PostAsync($"/api/activities/{id}/timer/pause", null));
            await Ok(await client.PostAsJsonAsync($"/api/activities/{id}/comments", new { text = "Comentário HTTP" }));
            var current = await Ok(await client.GetAsync($"/api/activities/{id}"));
            await Ok(await client.PatchAsJsonAsync($"/api/activities/{id}/status", new { status = "Done", version = current.GetProperty("version").GetString() }));
            var stats = await Ok(await client.GetAsync("/api/dashboard")); Assert.Equal(1, stats.GetProperty("completed").GetInt32());
            await Ok(await client.GetAsync($"/api/activities/{id}/details"));
            foreach (var format in new[] { "csv", "xlsx", "pdf" }) { var response = await client.GetAsync($"/api/reports/completed/{format}"); Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync()); Assert.True((await response.Content.ReadAsByteArrayAsync()).Length > 20); }
            var averageReport = await client.GetAsync("/api/reports/completion/csv");
            Assert.True(averageReport.IsSuccessStatusCode);
            Assert.Contains("Tempo médio de conclusão", await averageReport.Content.ReadAsStringAsync());
            await Ok(await client.GetAsync("/swagger/v1/swagger.json"));
        }
        finally { if (connection.InitialCatalog.StartsWith("SecOpsManager_ApiTests_", StringComparison.Ordinal)) await db.Database.EnsureDeletedAsync(); }
    }
}
