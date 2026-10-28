using System.ComponentModel.DataAnnotations;
using SecOps.Domain;
namespace SecOps.Application;
public record ActivityInput([Required, StringLength(200, MinimumLength = 3)] string Title, [StringLength(12000)] string Description,
    Guid CategoryId, [StringLength(100)] string Subcategory, Priority Priority, Priority Severity, Guid? AssigneeId, Guid? ClientId,
    [StringLength(100)] string Team, DateTimeOffset DueAt, DateTimeOffset SlaAt, [Range(0, 10000)] decimal EstimatedHours, bool Blocked, string? Version);
public record StatusInput(ActivityStatus Status, [Required] string Version);
public record TextInput([Required, StringLength(8000)] string Text);
public record ActivityFilter(string? Search = null, ActivityStatus? Status = null, Guid? CategoryId = null, Guid? ClientId = null,
    Guid? AssigneeId = null, DateTimeOffset? From = null, DateTimeOffset? To = null, bool? Late = null, bool? Blocked = null,
    string Sort = "due", int Page = 1, int PageSize = 50);
public record Page<T>(IReadOnlyList<T> Items, int Total, int PageNumber, int PageSize);
public record ActivityDto(Guid Id, string Title, string Description, Guid CategoryId, string Category, string Subcategory,
    Priority Priority, Priority Severity, Guid? AssigneeId, string Assignee, Guid? ClientId, string Client, string Team,
    Guid RequesterId, ActivityStatus Status, bool Blocked, DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset DueAt,
    DateTimeOffset SlaAt, DateTimeOffset? CompletedAt, decimal EstimatedHours, double ActualHours, bool Late, bool SlaViolated,
    string Version, bool TimerRunning, Guid? ApprovedBy);
public record AiSuggestion(string Title, string Description, string[] AcceptanceCriteria, string BusinessJustification, string[] Tasks);
public record ReportFile(byte[] Content, string ContentType, string Extension);
public interface IActivityRepository
{
    Task<Page<Activity>> Search(ActivityFilter filter, CancellationToken ct);
    Task<Activity> Get(Guid id, CancellationToken ct);
    void Add(Activity activity);
    void SetOriginalVersion(Activity activity, string version);
    Task Save(CancellationToken ct);
}
public interface ICurrentUser { Guid Id { get; } string Name { get; } string Email { get; } }
public interface IActivityService
{
    Task<Page<ActivityDto>> Search(ActivityFilter filter, CancellationToken ct);
    Task<ActivityDto> Get(Guid id, CancellationToken ct);
    Task<ActivityDto> Create(ActivityInput input, CancellationToken ct);
    Task<ActivityDto> Update(Guid id, ActivityInput input, CancellationToken ct);
    Task<ActivityDto> ChangeStatus(Guid id, StatusInput input, CancellationToken ct);
    Task Delete(Guid id, string version, CancellationToken ct);
    Task Approve(Guid id, string version, CancellationToken ct);
    Task Comment(Guid id, string text, CancellationToken ct);
    Task Timer(Guid id, string action, CancellationToken ct);
}
public interface IActivityJournal { Task ValidateReferences(ActivityInput input, CancellationToken ct); void Record(Activity activity, string action, object details); Task Notify(Activity activity, string kind, CancellationToken ct); }
public interface IAiService { Task<AiSuggestion> Suggest(ActivityDto activity, CancellationToken ct); }
// Future adapter contract. No remote writes are performed by the shipped disabled adapter.
public interface IAzureDevOpsService
{
    Task<AzureDevOpsSync> Create(ActivityDto activity, string project, string workItemType, CancellationToken ct);
    Task Update(ActivityDto activity, AzureDevOpsSync link, CancellationToken ct);
    Task SyncStatus(ActivityDto activity, AzureDevOpsSync link, CancellationToken ct);
    Task<IReadOnlyList<AiSuggestion>> Import(string project, string workItemType, CancellationToken ct);
}
public static class ActivityMapping
{
    public static ActivityDto Dto(Activity a) { var now = DateTimeOffset.UtcNow; return new(a.Id, a.Title, a.Description, a.CategoryId, a.Category?.Name ?? "", a.Subcategory, a.Priority, a.Severity, a.AssigneeId, a.Assignee?.Name ?? "Sem responsável", a.ClientId, a.Client?.Name ?? "Interno", a.Team, a.RequesterId, a.Status, a.Blocked, a.CreatedAt, a.StartedAt, a.DueAt, a.SlaAt, a.CompletedAt, a.EstimatedHours, Math.Round(a.TimeEntries.Sum(t => t.Hours(now)), 2), a.IsLate(now), a.SlaViolated(now), Convert.ToBase64String(a.Version), a.TimeEntries.Any(t => t.EndedAt == null), a.ApprovedBy); }
}
