using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SecOps.Application;
using SecOps.Domain;
using SecOps.Infrastructure;
namespace SecOps.Api.Controllers;
[ApiController, Route("api")]
public class WorkspaceController(SecOpsDbContext db, ICurrentUser current, IConfiguration config) : ControllerBase
{
    [HttpPost("session/{operation}")]
    public async Task<object> Session(string operation, CancellationToken ct)
    {
        var action = operation;
        if (action is not ("login" or "logout")) throw new ArgumentException("Ação inválida.");
        var user = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == current.Id, ct);
        if (user == null) { user = new() { Id = current.Id }; db.Users.Add(user); }
        user.Name = current.Name; user.Email = current.Email;
        var roleNames = User.FindAll("roles").Select(c => c.Value).ToArray(); user.Roles = await db.Roles.Where(r => roleNames.Contains(r.Name)).ToListAsync(ct);
        db.AuditLogs.Add(new() { UserId = current.Id, Action = action == "login" ? "Login" : "Logout", Details = "Session action reported by client" }); await db.SaveChangesAsync(ct);
        return new { user.Id, user.Name, user.Email, roles = roleNames };
    }
    [HttpGet("catalog")] public async Task<object> Catalog(CancellationToken ct) => new { categories = await db.Categories.OrderBy(c => c.Name).ToListAsync(ct), clients = await db.Clients.Where(c => c.Active).OrderBy(c => c.Name).ToListAsync(ct), users = await db.Users.OrderBy(u => u.Name).Select(u => new { u.Id, u.Name, u.Email }).ToListAsync(ct) };
    [HttpPost("clients"), Authorize(Policy = "Admin")] public async Task<Client> Client(TextInput input, CancellationToken ct) { var client = new Client { Name = input.Text.Trim() }; db.Clients.Add(client); db.AuditLogs.Add(new() { UserId = current.Id, Action = "Client.Create", Details = client.Name }); await db.SaveChangesAsync(ct); return client; }
    [HttpGet("audit"), Authorize(Policy = "Manage")] public async Task<object> Audit([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) { if (page < 1 || pageSize < 1 || pageSize > 200) throw new ArgumentException("Paginação inválida."); return new { items = await db.AuditLogs.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct), total = await db.AuditLogs.CountAsync(ct) }; }
    [HttpGet("notifications")] public async Task<object> Notifications(CancellationToken ct) => await db.Notifications.Where(n => n.Recipient == current.Email).OrderByDescending(n => n.CreatedAt).Take(100).Select(n => new { n.Id, n.ActivityId, n.Kind, n.Subject, n.CreatedAt, n.SentAt, n.Attempts, n.Error }).ToListAsync(ct);
    [HttpGet("dashboard")]
    public async Task<object> Dashboard([FromQuery] ActivityFilter filter, CancellationToken ct)
    {
        var repo = new ActivityRepository(db); var all = await ActivityRepository.Filter(repo.Loaded().AsNoTracking(), filter).Take(20001).ToListAsync(ct);
        if (all.Count > 20000) throw new ArgumentException("Mais de 20.000 atividades. Refine os filtros para gerar indicadores completos.");
        var now = DateTimeOffset.UtcNow; var zone = TimeZoneInfo.FindSystemTimeZoneById(config["BusinessTimeZone"] ?? "America/Sao_Paulo"); var local = TimeZoneInfo.ConvertTime(now, zone);
        var done = all.Where(a => a.Status == ActivityStatus.Done).ToArray(); var times = all.SelectMany(a => a.TimeEntries.Select(t => new { a.Category, a.Client, Entry = t })).ToArray();
        double Hours(IEnumerable<Activity> list) => Math.Round(list.Sum(a => a.TimeEntries.Sum(t => t.Hours(now))), 2);
        return new
        {
            total = all.Count,
            inProgress = all.Count(a => a.Status is ActivityStatus.Analysis or ActivityStatus.Execution or ActivityStatus.Validation),
            completed = done.Length,
            late = all.Count(a => a.IsLate(now)),
            blocked = all.Count(a => a.Blocked && a.IsOpen),
            slaViolated = all.Count(a => a.SlaViolated(now)),
            completedThisMonth = done.Count(a => a.CompletedAt.HasValue && TimeZoneInfo.ConvertTime(a.CompletedAt.Value, zone).ToString("yyyy-MM") == local.ToString("yyyy-MM")),
            hours = Hours(all),
            averageCompletionHours = done.Length == 0 ? 0 : Math.Round(done.Average(a => (a.CompletedAt!.Value - (a.StartedAt ?? a.CreatedAt)).TotalHours), 1),
            categories = all.GroupBy(a => a.Category.Name).Select(g => new { name = g.Key, value = g.Count() }),
            statuses = all.GroupBy(a => a.Status).Select(g => new { name = g.Key.ToString(), value = g.Count() }),
            assignees = all.GroupBy(a => a.Assignee?.Name ?? "Sem responsável").Select(g => new { name = g.Key, value = g.Count(), hours = Hours(g), completed = g.Count(a => a.Status == ActivityStatus.Done) }),
            monthly = Enumerable.Range(0, 6).Select(i => local.AddMonths(i - 5).ToString("yyyy-MM")).Select(month => new { name = month, created = all.Count(a => TimeZoneInfo.ConvertTime(a.CreatedAt, zone).ToString("yyyy-MM") == month), completed = done.Count(a => TimeZoneInfo.ConvertTime(a.CompletedAt!.Value, zone).ToString("yyyy-MM") == month) }),
            sla = new[] { new { name = "Cumprido", value = done.Count(a => !a.SlaViolated(now)) }, new { name = "Violado", value = all.Count(a => a.SlaViolated(now)) }, new { name = "Em prazo", value = all.Count(a => a.IsOpen && !a.SlaViolated(now)) } },
            hoursByCategory = all.GroupBy(a => a.Category.Name).Select(g => new { name = g.Key, value = Hours(g) }),
            hoursByClient = all.GroupBy(a => a.Client?.Name ?? "Interno").Select(g => new { name = g.Key, value = Hours(g) }),
            hoursByDay = times.GroupBy(t => TimeZoneInfo.ConvertTime(t.Entry.StartedAt, zone).ToString("yyyy-MM-dd")).Select(g => new { name = g.Key, value = Math.Round(g.Sum(t => t.Entry.Hours(now)), 2) }),
            hoursByWeek = times.GroupBy(t => { var d = TimeZoneInfo.ConvertTime(t.Entry.StartedAt, zone).Date; return d.AddDays(-(((int)d.DayOfWeek + 6) % 7)).ToString("yyyy-MM-dd"); }).Select(g => new { name = g.Key, value = Math.Round(g.Sum(t => t.Entry.Hours(now)), 2) }),
            hoursByMonth = times.GroupBy(t => TimeZoneInfo.ConvertTime(t.Entry.StartedAt, zone).ToString("yyyy-MM")).Select(g => new { name = g.Key, value = Math.Round(g.Sum(t => t.Entry.Hours(now)), 2) })
        };
    }
    [HttpGet("reports/{kind}/{format}")]
    public async Task<IActionResult> Report(string kind, string format, [FromQuery] ActivityFilter filter, CancellationToken ct)
    {
        var repo = new ActivityRepository(db); var all = await ActivityRepository.Filter(repo.Loaded().AsNoTracking(), filter).Take(10001).ToListAsync(ct);
        if (all.Count > 10000) throw new ArgumentException("Limite de relatório: 10.000 atividades. Refine os filtros.");
        var now = DateTimeOffset.UtcNow;
        IEnumerable<Activity> selected = kind switch { "open" => all.Where(a => a.IsOpen), "late" => all.Where(a => a.IsLate(now)), "pending" => all.Where(a => a.Blocked || a.Status == ActivityStatus.Waiting), "completed" => all.Where(a => a.Status == ActivityStatus.Done), "vulnerabilities" => all.Where(a => a.Subcategory == "Vulnerabilidade"), "assessments" => all.Where(a => a.Subcategory == "Assessment"), "incidents" => all.Where(a => a.Subcategory == "Incidente"), "backlog" => all.Where(a => a.Status == ActivityStatus.Backlog), "sla" or "hours" or "ranking" or "completion" => all, _ => throw new ArgumentException("Relatório desconhecido.") };
        string[] headers; List<string[]> rows;
        if (kind == "ranking") { headers = ["Responsável", "Concluídas", "Horas"]; rows = all.GroupBy(a => a.Assignee?.Name ?? "Sem responsável").OrderByDescending(g => g.Count(a => a.Status == ActivityStatus.Done)).Select(g => new[] { g.Key, g.Count(a => a.Status == ActivityStatus.Done).ToString(), g.Sum(a => a.TimeEntries.Sum(t => t.Hours(now))).ToString("F2") }).ToList(); }
        else if (kind == "completion")
        {
            headers = ["Responsável", "Concluídas", "Tempo médio de conclusão (h)"];
            rows = all.Where(a => a.Status == ActivityStatus.Done && a.CompletedAt.HasValue)
                .GroupBy(a => a.Assignee?.Name ?? "Sem responsável")
                .Select(g => new[] { g.Key, g.Count().ToString(), g.Average(a => (a.CompletedAt!.Value - (a.StartedAt ?? a.CreatedAt)).TotalHours).ToString("F2") }).ToList();
        }
        else { headers = ["ID", "Título", "Categoria", "Subcategoria", "Responsável", "Cliente", "Status", "Prazo UTC", "SLA UTC", "SLA violado", "Horas", "Tempo conclusão (h)"]; rows = selected.Select(a => new[] { a.Id.ToString(), a.Title, a.Category.Name, a.Subcategory, a.Assignee?.Name ?? "", a.Client?.Name ?? "", a.Status.ToString(), a.DueAt.ToString("O"), a.SlaAt.ToString("O"), a.SlaViolated(now) ? "Sim" : "Não", a.TimeEntries.Sum(t => t.Hours(now)).ToString("F2"), a.CompletedAt.HasValue ? (a.CompletedAt.Value - (a.StartedAt ?? a.CreatedAt)).TotalHours.ToString("F2") : "" }).ToList(); }
        var file = ReportExporter.Export(kind, headers, rows, format); db.Reports.Add(new() { UserId = current.Id, Kind = kind, Format = format, Rows = rows.Count }); db.AuditLogs.Add(new() { UserId = current.Id, Action = "Report.Export", Details = kind + ":" + format }); await db.SaveChangesAsync(ct); return File(file.Content, file.ContentType, $"secops-{kind}-{now:yyyyMMdd}.{file.Extension}");
    }
    [HttpGet("integrations")] public object Integrations() => new { entra = "Configured by environment", aiEnabled = config.GetValue<bool>("AI:Enabled"), emailEnabled = config.GetValue<bool>("Email:Enabled"), azureDevOps = "Prepared; remote sync not implemented" };
}
