using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SecOps.Application;
using SecOps.Domain;
using SecOps.Infrastructure;
namespace SecOps.Api.Controllers;
[ApiController, Route("api/activities")]
public class ActivitiesController(IActivityService service, SecOpsDbContext db, ICurrentUser user, IConfiguration config, IAiService ai) : ControllerBase
{
    [HttpGet] public Task<Page<ActivityDto>> List([FromQuery] ActivityFilter filter, CancellationToken ct) => service.Search(filter, ct);
    [HttpGet("{id:guid}")] public Task<ActivityDto> Get(Guid id, CancellationToken ct) => service.Get(id, ct);
    [HttpPost, Authorize(Policy = "Write")] public async Task<IActionResult> Create(ActivityInput input, CancellationToken ct) { var a = await service.Create(input, ct); return CreatedAtAction(nameof(Get), new { id = a.Id }, a); }
    [HttpPut("{id:guid}"), Authorize(Policy = "Write")] public Task<ActivityDto> Update(Guid id, ActivityInput input, CancellationToken ct) => service.Update(id, input, ct);
    [HttpPatch("{id:guid}/status"), Authorize(Policy = "Write")] public Task<ActivityDto> Status(Guid id, StatusInput input, CancellationToken ct) => service.ChangeStatus(id, input, ct);
    [HttpDelete("{id:guid}"), Authorize(Policy = "Admin")] public async Task<IActionResult> Delete(Guid id, [FromQuery] string version, CancellationToken ct) { await service.Delete(id, version, ct); return NoContent(); }
    [HttpPost("{id:guid}/approve"), Authorize(Policy = "Manage")] public async Task<IActionResult> Approve(Guid id, [FromBody] StatusInput input, CancellationToken ct) { await service.Approve(id, input.Version, ct); return NoContent(); }
    [HttpPost("{id:guid}/comments"), Authorize(Policy = "Write")] public async Task<IActionResult> Comment(Guid id, TextInput input, CancellationToken ct) { await service.Comment(id, input.Text, ct); return NoContent(); }
    [HttpGet("{id:guid}/details")]
    public async Task<object> Details(Guid id, CancellationToken ct)
    {
        await service.Get(id, ct);
        return new
        {
            comments = await db.ActivityComments.Where(c => c.ActivityId == id).OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync(ct),
            attachments = await db.ActivityAttachments.Where(a => a.ActivityId == id).Select(a => new { a.Id, a.FileName, a.Size, a.Kind, a.CreatedAt }).ToListAsync(ct),
            timeEntries = await db.ActivityTimeEntries.Where(t => t.ActivityId == id).OrderByDescending(t => t.StartedAt).Take(500).ToListAsync(ct),
            history = await db.AuditLogs.Where(a => a.ActivityId == id).OrderByDescending(a => a.CreatedAt).Take(500).ToListAsync(ct),
            azureDevOps = await db.AzureDevOpsSync.FirstOrDefaultAsync(a => a.ActivityId == id, ct)
        };
    }
    [HttpPost("{id:guid}/timer/{operation}"), Authorize(Policy = "Write")] public async Task<IActionResult> Timer(Guid id, string operation, CancellationToken ct) { await service.Timer(id, operation, ct); return NoContent(); }
    [HttpPost("{id:guid}/suggestion"), Authorize(Policy = "Write")]
    public async Task<AiSuggestion> Suggest(Guid id, CancellationToken ct)
    {
        var result = await ai.Suggest(await service.Get(id, ct), ct); db.AuditLogs.Add(new() { UserId = user.Id, ActivityId = id, Action = "AI.Suggestion", Details = "Suggestion generated; no work item created" }); await db.SaveChangesAsync(ct); return result;
    }
    [HttpPost("{id:guid}/attachments"), Authorize(Policy = "Write"), RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid id, IFormFile file, CancellationToken ct)
    {
        await service.Get(id, ct);
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (file.Length <= 0 || file.Length > 10 * 1024 * 1024 || !new[] { ".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv", ".xlsx", ".docx" }.Contains(extension)) throw new ArgumentException("Anexo: até 10 MB; PDF, imagem, TXT, CSV, XLSX ou DOCX.");
        var storage = Path.GetFullPath(config["StoragePath"] ?? "storage"); Directory.CreateDirectory(storage);
        var attachment = new ActivityAttachment { ActivityId = id, UserId = user.Id, FileName = Path.GetFileName(file.FileName), Size = file.Length, StorageKey = Guid.NewGuid().ToString("N") };
        var path = Path.Combine(storage, attachment.StorageKey);
        try { await using (var output = System.IO.File.Create(path)) await file.CopyToAsync(output, ct); db.ActivityAttachments.Add(attachment); db.AuditLogs.Add(new() { UserId = user.Id, ActivityId = id, Action = "Attachment", Details = attachment.FileName }); await db.SaveChangesAsync(ct); }
        catch { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); throw; }
        return Ok(new { attachment.Id, attachment.FileName, attachment.Size });
    }
    [HttpGet("{id:guid}/attachments/{attachmentId:guid}")]
    public async Task<IActionResult> Download(Guid id, Guid attachmentId, CancellationToken ct)
    {
        await service.Get(id, ct); var a = await db.ActivityAttachments.SingleOrDefaultAsync(a => a.Id == attachmentId && a.ActivityId == id, ct) ?? throw new KeyNotFoundException();
        return PhysicalFile(Path.Combine(Path.GetFullPath(config["StoragePath"] ?? "storage"), a.StorageKey), "application/octet-stream", a.FileName);
    }
}
