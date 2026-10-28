using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SecOps.Application;
using SecOps.Domain;
namespace SecOps.Infrastructure;
public class ActivityJournal(SecOpsDbContext db, ICurrentUser user) : IActivityJournal
{
    public async Task ValidateReferences(ActivityInput i, CancellationToken ct)
    {
        var category = await db.Categories.FindAsync([i.CategoryId], ct) ?? throw new ArgumentException("Categoria inválida.");
        if (!string.IsNullOrEmpty(i.Subcategory) && !category.Subcategories.Contains(i.Subcategory)) throw new ArgumentException("Subcategoria inválida.");
        if (i.AssigneeId.HasValue && !await db.Users.AnyAsync(u => u.Id == i.AssigneeId, ct)) throw new ArgumentException("Responsável inválido.");
        if (i.ClientId.HasValue && !await db.Clients.AnyAsync(c => c.Id == i.ClientId && c.Active, ct)) throw new ArgumentException("Cliente inválido.");
    }
    public void Record(Activity a, string action, object details) => db.AuditLogs.Add(new() { ActivityId = a.Id, UserId = user.Id, Action = action, Details = JsonSerializer.Serialize(details) });
    public async Task Notify(Activity a, string kind, CancellationToken ct)
    {
        if (a.AssigneeId is not Guid id) return;
        var recipient = await db.Users.FindAsync([id], ct); if (string.IsNullOrWhiteSpace(recipient?.Email)) return;
        db.Notifications.Add(new() { ActivityId = a.Id, Kind = kind, Recipient = recipient.Email, Subject = $"SecOps · {kind}: {a.Title}", Text = a.Title, DeduplicationKey = Guid.NewGuid().ToString("N") });
    }
}
