namespace SecOps.Domain;
public enum ActivityStatus { Backlog, Todo, Analysis, Execution, Waiting, Validation, Done, Cancelled }
public enum Priority { Low, Normal, High, Critical }
public class Entity { public Guid Id { get; set; } = Guid.NewGuid(); }
public class User : Entity { public string Name { get; set; } = ""; public string Email { get; set; } = ""; public ICollection<Role> Roles { get; set; } = []; }
public class Role : Entity { public string Name { get; set; } = ""; }
public class Category : Entity { public string Name { get; set; } = ""; public string[] Subcategories { get; set; } = []; }
public class Client : Entity { public string Name { get; set; } = ""; public bool Active { get; set; } = true; }
public class Activity : Entity
{
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string Subcategory { get; set; } = "";
    public Priority Priority { get; set; }
    public Priority Severity { get; set; }
    public Guid? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public Guid RequesterId { get; set; }
    public User Requester { get; set; } = null!;
    public Guid? ClientId { get; set; }
    public Client? Client { get; set; }
    public string Team { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset DueAt { get; set; }
    public DateTimeOffset SlaAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public decimal EstimatedHours { get; set; }
    public ActivityStatus Status { get; set; }
    public bool Blocked { get; set; }
    public bool Deleted { get; set; }
    public byte[] Version { get; set; } = [];
    public ICollection<ActivityComment> Comments { get; set; } = [];
    public ICollection<ActivityAttachment> Attachments { get; set; } = [];
    public ICollection<ActivityTimeEntry> TimeEntries { get; set; } = [];
    public AzureDevOpsSync? AzureDevOpsSync { get; set; }
    public bool IsOpen => Status is not (ActivityStatus.Done or ActivityStatus.Cancelled);
    public bool IsLate(DateTimeOffset now) => IsOpen && DueAt < now;
    public bool SlaViolated(DateTimeOffset now) => Status != ActivityStatus.Cancelled && (CompletedAt ?? now) > SlaAt;
    public void Transition(ActivityStatus status, DateTimeOffset now)
    {
        if (!Enum.IsDefined(status)) throw new ArgumentException("Status inválido.");
        if (status == Status) return;
        if (TimeEntries.Any(t => t.EndedAt == null) && status is ActivityStatus.Done or ActivityStatus.Cancelled)
            throw new InvalidOperationException("Pause o cronômetro antes de encerrar a atividade.");
        Status = status; UpdatedAt = now;
        if (status == ActivityStatus.Execution) StartedAt ??= now;
        CompletedAt = status == ActivityStatus.Done ? now : null;
        if (status != ActivityStatus.Done) { ApprovedAt = null; ApprovedBy = null; }
    }
}
public class ActivityComment : Entity { public Guid ActivityId { get; set; } public Guid UserId { get; set; } public string Text { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class ActivityAttachment : Entity { public Guid ActivityId { get; set; } public Guid UserId { get; set; } public string FileName { get; set; } = ""; public string StorageKey { get; set; } = ""; public long Size { get; set; } public string Kind { get; set; } = "Evidence"; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class ActivityTimeEntry : Entity { public Guid ActivityId { get; set; } public Guid UserId { get; set; } public DateTimeOffset StartedAt { get; set; } public DateTimeOffset? EndedAt { get; set; } public string Note { get; set; } = ""; public byte[] Version { get; set; } = []; public double Hours(DateTimeOffset now) => Math.Max(0, ((EndedAt ?? now) - StartedAt).TotalHours); }
public class Notification : Entity { public Guid ActivityId { get; set; } public string Kind { get; set; } = ""; public string Recipient { get; set; } = ""; public string Subject { get; set; } = ""; public string Text { get; set; } = ""; public string DeduplicationKey { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public DateTimeOffset? SentAt { get; set; } public int Attempts { get; set; } public string? Error { get; set; } }
public class Report : Entity { public string Kind { get; set; } = ""; public string Format { get; set; } = ""; public Guid UserId { get; set; } public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public int Rows { get; set; } }
public class AuditLog : Entity { public Guid UserId { get; set; } public Guid? ActivityId { get; set; } public string Action { get; set; } = ""; public string Details { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public class AzureDevOpsSync : Entity { public Guid ActivityId { get; set; } public string Project { get; set; } = ""; public string WorkItemType { get; set; } = ""; public int? WorkItemId { get; set; } public string? Url { get; set; } public DateTimeOffset? SyncDate { get; set; } }
