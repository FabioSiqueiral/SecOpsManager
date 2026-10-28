using SecOps.Domain;
using SecOps.Infrastructure;
using Xunit;
namespace SecOps.Tests;
public class DomainTests
{
    [Fact] public void Completion_requires_all_timers_stopped() { var a = new Activity { TimeEntries = [new() { StartedAt = DateTimeOffset.UtcNow }] }; Assert.Throws<InvalidOperationException>(() => a.Transition(ActivityStatus.Done, DateTimeOffset.UtcNow)); Assert.Equal(ActivityStatus.Backlog, a.Status); }
    [Fact] public void Reopening_clears_approval_and_completion() { var a = new Activity { Status = ActivityStatus.Done, ApprovedBy = Guid.NewGuid(), ApprovedAt = DateTimeOffset.UtcNow, CompletedAt = DateTimeOffset.UtcNow }; a.Transition(ActivityStatus.Execution, DateTimeOffset.UtcNow); Assert.Null(a.ApprovedBy); Assert.Null(a.ApprovedAt); Assert.Null(a.CompletedAt); Assert.NotNull(a.StartedAt); }
    [Fact] public void Completed_sla_uses_completion_instead_of_current_date() { var due = DateTimeOffset.UtcNow.AddDays(-4); var a = new Activity { Status = ActivityStatus.Done, DueAt = due, SlaAt = due, CompletedAt = due.AddHours(-1) }; Assert.False(a.IsLate(DateTimeOffset.UtcNow)); Assert.False(a.SlaViolated(DateTimeOffset.UtcNow)); a.CompletedAt = due.AddHours(1); Assert.True(a.SlaViolated(DateTimeOffset.UtcNow)); }
    [Fact] public void Cancelled_work_does_not_violate_sla() { var a = new Activity { Status = ActivityStatus.Cancelled, SlaAt = DateTimeOffset.UtcNow.AddDays(-1) }; Assert.False(a.SlaViolated(DateTimeOffset.UtcNow)); }
    [Fact] public void Time_stops_at_end_and_never_goes_negative() { var start = DateTimeOffset.UtcNow; var t = new ActivityTimeEntry { StartedAt = start, EndedAt = start.AddMinutes(90) }; Assert.Equal(1.5, t.Hours(start.AddDays(2))); t.EndedAt = start.AddHours(-1); Assert.Equal(0, t.Hours(start)); }
    [Theory]
    [InlineData("=1+1")]
    [InlineData(" @SUM(A1)")]
    [InlineData("+cmd")]
    [InlineData("-cmd")]
    [InlineData("\tformula")]
    public void Export_neutralizes_spreadsheet_formulas(string input) => Assert.StartsWith("'", ReportExporter.Safe(input));
    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    [InlineData("pdf")]
    public void Export_produces_real_formats(string format) { var file = ReportExporter.Export("Validação", ["Título", "Horas"], new[] { new[] { "Ação de segurança", "2,5" } }, format); Assert.True(file.Content.Length > 40); if (format == "xlsx") Assert.Equal("PK", System.Text.Encoding.ASCII.GetString(file.Content, 0, 2)); if (format == "pdf") Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(file.Content, 0, 4)); if (format == "csv") Assert.Contains("Ação de segurança", System.Text.Encoding.UTF8.GetString(file.Content)); }
}
