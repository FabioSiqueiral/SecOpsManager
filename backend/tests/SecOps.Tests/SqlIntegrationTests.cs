using Microsoft.EntityFrameworkCore;
using SecOps.Application;
using SecOps.Domain;
using SecOps.Infrastructure;
using Xunit;
namespace SecOps.Tests;
public class SqlIntegrationTests
{
    [Fact, Trait("Category", "Integration")]
    public async Task SqlServer_roundtrip_timer_audit_and_concurrency()
    {
        var connection = Environment.GetEnvironmentVariable("SECOPS_TEST_SQL"); Assert.False(string.IsNullOrWhiteSpace(connection), "Configure SECOPS_TEST_SQL para o teste SQL.");
        var options = new DbContextOptionsBuilder<SecOpsDbContext>().UseSqlServer(connection).Options;
        await using var db = new SecOpsDbContext(options); await db.Database.MigrateAsync(); await using var transaction = await db.Database.BeginTransactionAsync();
        var actor = new Actor(); db.Users.Add(new() { Id = actor.Id, Name = actor.Name, Email = actor.Email }); await db.SaveChangesAsync();
        var service = new ActivityService(new ActivityRepository(db), new ActivityJournal(db, actor), actor);
        var input = new ActivityInput("Teste de integração SQL", "Verificação transacional", Guid.Parse("10000000-0000-0000-0000-000000000001"), "Assessment", Priority.High, Priority.Normal, actor.Id, null, "QA", DateTimeOffset.UtcNow.AddDays(1), DateTimeOffset.UtcNow.AddDays(2), 3, false, null);
        var created = await service.Create(input, default); Assert.NotEqual("", created.Version); Assert.Equal("Segurança", created.Category);
        await service.Timer(created.Id, "start", default); Assert.True((await service.Get(created.Id, default)).TimerRunning);
        await service.Timer(created.Id, "pause", default); Assert.False((await service.Get(created.Id, default)).TimerRunning);
        await service.Comment(created.Id, "Evidência de teste", default); Assert.Equal(1, await db.ActivityComments.CountAsync(c => c.ActivityId == created.Id));
        var current = await service.Get(created.Id, default); var done = await service.ChangeStatus(created.Id, new(ActivityStatus.Done, current.Version), default); await service.Approve(created.Id, done.Version, default);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.ActivityId == created.Id && a.Action == "Approve")); Assert.True(await db.Notifications.AnyAsync(n => n.ActivityId == created.Id && n.Kind == "Completed"));
        var page = await service.Search(new(Search: "Teste de integração SQL", AssigneeId: actor.Id), default); Assert.Single(page.Items);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.Update(created.Id, input with { Title = "Atualização obsoleta", Version = created.Version }, default));
        await transaction.RollbackAsync();
    }
    private class Actor : ICurrentUser { public Guid Id { get; } = Guid.NewGuid(); public string Name => "Teste automatizado"; public string Email => "test@example.test"; }
}
