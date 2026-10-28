using SecOps.Domain;
namespace SecOps.Application;
public sealed class ActivityService(IActivityRepository repo, IActivityJournal journal, ICurrentUser user) : IActivityService
{
    public async Task<Page<ActivityDto>> Search(ActivityFilter filter, CancellationToken ct) { var page = await repo.Search(filter, ct); return new(page.Items.Select(ActivityMapping.Dto).ToArray(), page.Total, page.PageNumber, page.PageSize); }
    public async Task<ActivityDto> Get(Guid id, CancellationToken ct) => ActivityMapping.Dto(await repo.Get(id, ct));
    public async Task<ActivityDto> Create(ActivityInput input, CancellationToken ct)
    {
        await Validate(input, ct); var activity = new Activity { RequesterId = user.Id }; Apply(activity, input); repo.Add(activity);
        journal.Record(activity, "Create", new { activity.Title }); await journal.Notify(activity, "Assigned", ct); await repo.Save(ct); return await Get(activity.Id, ct);
    }
    public async Task<ActivityDto> Update(Guid id, ActivityInput input, CancellationToken ct)
    {
        await Validate(input, ct); var a = await repo.Get(id, ct); var before = ActivityMapping.Dto(a); repo.SetOriginalVersion(a, input.Version ?? "");
        var reassigned = a.AssigneeId != input.AssigneeId; Apply(a, input); journal.Record(a, "Edit", new { Before = before, After = ActivityMapping.Dto(a) });
        if (reassigned) await journal.Notify(a, "Assigned", ct); await repo.Save(ct); return await Get(id, ct);
    }
    public async Task<ActivityDto> ChangeStatus(Guid id, StatusInput input, CancellationToken ct)
    {
        var a = await repo.Get(id, ct); repo.SetOriginalVersion(a, input.Version); var before = a.Status;
        a.Transition(input.Status, DateTimeOffset.UtcNow); journal.Record(a, "Status", new { Before = before, After = a.Status });
        if (a.Status == ActivityStatus.Done && before != ActivityStatus.Done) await journal.Notify(a, "Completed", ct);
        await repo.Save(ct); return ActivityMapping.Dto(a);
    }
    public async Task Delete(Guid id, string version, CancellationToken ct) { var a = await repo.Get(id, ct); repo.SetOriginalVersion(a, version); if (a.TimeEntries.Any(t => t.EndedAt == null)) throw new InvalidOperationException("Pause os cronômetros antes de excluir."); a.Deleted = true; journal.Record(a, "Delete", new { a.Title }); await repo.Save(ct); }
    public async Task Approve(Guid id, string version, CancellationToken ct) { var a = await repo.Get(id, ct); repo.SetOriginalVersion(a, version); if (a.Status != ActivityStatus.Done) throw new InvalidOperationException("Conclua a atividade antes da aprovação."); a.ApprovedBy = user.Id; a.ApprovedAt = DateTimeOffset.UtcNow; journal.Record(a, "Approve", new { a.ApprovedAt }); await repo.Save(ct); }
    public async Task Comment(Guid id, string text, CancellationToken ct) { var a = await repo.Get(id, ct); a.Comments.Add(new() { UserId = user.Id, Text = text.Trim() }); journal.Record(a, "Comment", new { Text = text }); await journal.Notify(a, "Comment", ct); await repo.Save(ct); }
    public async Task Timer(Guid id, string action, CancellationToken ct)
    {
        var a = await repo.Get(id, ct); var running = a.TimeEntries.FirstOrDefault(t => t.UserId == user.Id && t.EndedAt == null);
        if (action == "start") { if (!a.IsOpen || running != null) throw new InvalidOperationException("Atividade encerrada ou cronômetro já iniciado."); a.TimeEntries.Add(new() { UserId = user.Id, StartedAt = DateTimeOffset.UtcNow }); a.StartedAt ??= DateTimeOffset.UtcNow; }
        else if (action is "pause" or "stop") { if (running == null) throw new InvalidOperationException("Nenhum cronômetro seu está ativo."); running.EndedAt = DateTimeOffset.UtcNow; }
        else throw new ArgumentException("Ação inválida.");
        a.UpdatedAt = DateTimeOffset.UtcNow; journal.Record(a, "Timer:" + action, new { }); await repo.Save(ct);
    }
    private async Task Validate(ActivityInput i, CancellationToken ct) { if (string.IsNullOrWhiteSpace(i.Title) || i.Title.Length > 200 || !Enum.IsDefined(i.Priority) || !Enum.IsDefined(i.Severity) || i.DueAt == default || i.SlaAt == default || i.EstimatedHours < 0) throw new ArgumentException("Dados da atividade inválidos."); await journal.ValidateReferences(i, ct); }
    private static void Apply(Activity a, ActivityInput i) { a.Title = i.Title.Trim(); a.Description = i.Description; a.CategoryId = i.CategoryId; a.Subcategory = i.Subcategory; a.Priority = i.Priority; a.Severity = i.Severity; a.AssigneeId = i.AssigneeId; a.ClientId = i.ClientId; a.Team = i.Team; a.DueAt = i.DueAt; a.SlaAt = i.SlaAt; a.EstimatedHours = i.EstimatedHours; a.Blocked = i.Blocked; a.UpdatedAt = DateTimeOffset.UtcNow; a.ApprovedAt = null; a.ApprovedBy = null; }
}
