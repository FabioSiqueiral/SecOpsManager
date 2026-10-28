using System.Net;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;
using SecOps.Domain;
namespace SecOps.Infrastructure;
// Single worker instance. Transactional outbox: notifications are saved with activity changes.
public sealed class NotificationWorker(IServiceScopeFactory scopes, IConfiguration config, ILogger<NotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (!config.GetValue<bool>("Email:Enabled")) continue;
            try { await Process(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogError(ex, "Notification cycle failed"); }
        }
    }
    private async Task Process(CancellationToken ct)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<SecOpsDbContext>();
        var now = DateTimeOffset.UtcNow; var zone = TimeZoneInfo.FindSystemTimeZoneById(config["BusinessTimeZone"] ?? "America/Sao_Paulo"); var today = TimeZoneInfo.ConvertTime(now, zone).Date;
        var open = await db.Activities.Include(a => a.Assignee).Where(a => a.Status != ActivityStatus.Done && a.Status != ActivityStatus.Cancelled && a.Assignee != null).ToListAsync(ct);
        foreach (var a in open)
        {
            var days = (TimeZoneInfo.ConvertTime(a.DueAt, zone).Date - today).Days;
            var kinds = new List<string>(); if (days is 7 or 3 or 0) kinds.Add("Due" + days); if (days < 0) kinds.Add("Overdue"); if (a.SlaAt < now) kinds.Add("SlaExpired");
            foreach (var kind in kinds)
            {
                var key = $"{a.Id}:{a.AssigneeId}:{kind}:{today:yyyyMMdd}";
                if (!string.IsNullOrWhiteSpace(a.Assignee!.Email) && !await db.Notifications.AnyAsync(n => n.DeduplicationKey == key, ct)) db.Notifications.Add(new() { ActivityId = a.Id, Recipient = a.Assignee.Email, Kind = kind, Subject = $"SecOps · {kind}: {a.Title}", Text = a.Title, DeduplicationKey = key });
            }
        }
        await db.SaveChangesAsync(ct);
        var pending = await db.Notifications.Where(n => n.SentAt == null && n.Attempts < 5).OrderBy(n => n.CreatedAt).Take(50).ToListAsync(ct);
        foreach (var n in pending)
        {
            try
            {
                var message = new MimeMessage(); message.From.Add(MailboxAddress.Parse(config["Email:From"] ?? "secops@example.com")); message.To.Add(MailboxAddress.Parse(n.Recipient)); message.Subject = n.Subject;
                var link = (config["FrontendUrl"] ?? "http://localhost:3300").TrimEnd('/') + "/?activity=" + n.ActivityId;
                var logo = config["Email:LogoUrl"]; var image = Uri.TryCreate(logo, UriKind.Absolute, out var logoUri) && logoUri.Scheme == "https" ? $"<img alt='Empresa' height='40' src='{WebUtility.HtmlEncode(logo)}'>" : "";
                message.Body = new BodyBuilder { HtmlBody = $"<html><body style='font-family:Arial;background:#f1f5f9;padding:30px'><main style='max-width:600px;background:white;padding:32px;border-radius:12px'>{image}<h2>SecOps Manager</h2><p>{WebUtility.HtmlEncode(n.Text)}</p><p>{WebUtility.HtmlEncode(n.Kind)}</p><a style='background:#087f8c;color:white;padding:12px 20px' href='{WebUtility.HtmlEncode(link)}'>Abrir atividade</a></main></body></html>", TextBody = n.Text + "\n" + link }.ToMessageBody();
                using var smtp = new SmtpClient(); await smtp.ConnectAsync(config["Email:Host"] ?? throw new InvalidOperationException("Configure Email:Host."), config.GetValue<int>("Email:Port", 587), SecureSocketOptions.StartTls, ct);
                var username = config["Email:Username"];
                if (!string.IsNullOrWhiteSpace(username)) await smtp.AuthenticateAsync(username, config["Email:Password"] ?? "", ct);
                await smtp.SendAsync(message, ct); await smtp.DisconnectAsync(true, ct); n.SentAt = DateTimeOffset.UtcNow; n.Error = null;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested) { n.Error = ex.GetType().Name; logger.LogWarning("Email {NotificationId} failed: {ErrorType}", n.Id, n.Error); }
            n.Attempts++; await db.SaveChangesAsync(ct);
        }
    }
}
