using Microsoft.EntityFrameworkCore;
using SecOps.Application;
using SecOps.Domain;
namespace SecOps.Infrastructure;
public class ActivityRepository(SecOpsDbContext db) : IActivityRepository
{
    public static IQueryable<Activity> Filter(IQueryable<Activity> q, ActivityFilter f)
    {
        if (f.From > f.To) throw new ArgumentException("Período inválido.");
        if (!string.IsNullOrWhiteSpace(f.Search)) { var s = f.Search.Trim(); if (s.Length > 200) throw new ArgumentException("Busca muito longa."); q = q.Where(a => a.Title.Contains(s) || a.Description.Contains(s) || a.Team.Contains(s)); }
        if (f.Status.HasValue) q = q.Where(a => a.Status == f.Status);
        if (f.CategoryId.HasValue) q = q.Where(a => a.CategoryId == f.CategoryId);
        if (f.ClientId.HasValue) q = q.Where(a => a.ClientId == f.ClientId);
        if (f.AssigneeId.HasValue) q = q.Where(a => a.AssigneeId == f.AssigneeId);
        if (f.From.HasValue) q = q.Where(a => a.CreatedAt >= f.From);
        if (f.To.HasValue) q = q.Where(a => a.CreatedAt <= f.To);
        if (f.Blocked.HasValue) q = q.Where(a => a.Blocked == f.Blocked);
        if (f.Late == true) { var now = DateTimeOffset.UtcNow; q = q.Where(a => a.DueAt < now && a.Status != ActivityStatus.Done && a.Status != ActivityStatus.Cancelled); }
        return q;
    }
    public IQueryable<Activity> Loaded() => db.Activities.Include(a => a.Category).Include(a => a.Assignee).Include(a => a.Client).Include(a => a.TimeEntries).AsSplitQuery();
    public async Task<Page<Activity>> Search(ActivityFilter f, CancellationToken ct)
    {
        if (f.Page < 1 || f.PageSize < 1 || f.PageSize > 500) throw new ArgumentException("Paginação: 1 a 500 itens por página.");
        var q = Filter(Loaded().AsNoTracking(), f); var total = await q.CountAsync(ct);
        q = f.Sort switch { "created" => q.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id), "priority" => q.OrderByDescending(a => a.Priority).ThenBy(a => a.Id), "title" => q.OrderBy(a => a.Title).ThenBy(a => a.Id), _ => q.OrderBy(a => a.DueAt).ThenBy(a => a.Id) };
        return new(await q.Skip(checked((f.Page - 1) * f.PageSize)).Take(f.PageSize).ToListAsync(ct), total, f.Page, f.PageSize);
    }
    public async Task<Activity> Get(Guid id, CancellationToken ct) => await Loaded().FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw new KeyNotFoundException("Atividade não encontrada.");
    public void Add(Activity a) => db.Activities.Add(a);
    public void SetOriginalVersion(Activity a, string version) { try { var v = Convert.FromBase64String(version); if (v.Length != 8) throw new FormatException(); db.Entry(a).Property(x => x.Version).OriginalValue = v; } catch (FormatException) { throw new ArgumentException("Versão inválida. Atualize a atividade."); } }
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
