using Microsoft.EntityFrameworkCore;
using SecOps.Domain;
namespace SecOps.Infrastructure;
public class SecOpsDbContext(DbContextOptions<SecOpsDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>(); public DbSet<Role> Roles => Set<Role>(); public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Category> Categories => Set<Category>(); public DbSet<Client> Clients => Set<Client>(); public DbSet<ActivityComment> ActivityComments => Set<ActivityComment>();
    public DbSet<ActivityAttachment> ActivityAttachments => Set<ActivityAttachment>(); public DbSet<ActivityTimeEntry> ActivityTimeEntries => Set<ActivityTimeEntry>();
    public DbSet<Notification> Notifications => Set<Notification>(); public DbSet<Report> Reports => Set<Report>(); public DbSet<AuditLog> AuditLogs => Set<AuditLog>(); public DbSet<AzureDevOpsSync> AzureDevOpsSync => Set<AzureDevOpsSync>();
    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<Activity>().HasQueryFilter(a => !a.Deleted); m.Entity<Activity>().Property(a => a.Version).IsRowVersion(); m.Entity<Activity>().Property(a => a.EstimatedHours).HasPrecision(10, 2);
        m.Entity<Activity>().Property(a => a.Title).HasMaxLength(200); m.Entity<Activity>().HasIndex(a => new { a.Status, a.DueAt }); m.Entity<Activity>().HasIndex(a => a.AssigneeId);
        m.Entity<Activity>().HasOne(a => a.Requester).WithMany().HasForeignKey(a => a.RequesterId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Activity>().HasOne(a => a.Assignee).WithMany().HasForeignKey(a => a.AssigneeId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Activity>().HasOne(a => a.Category).WithMany().HasForeignKey(a => a.CategoryId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Activity>().HasOne(a => a.Client).WithMany().HasForeignKey(a => a.ClientId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Activity>().HasMany(a => a.Comments).WithOne().HasForeignKey(a => a.ActivityId);
        m.Entity<Activity>().HasMany(a => a.TimeEntries).WithOne().HasForeignKey(a => a.ActivityId);
        m.Entity<Activity>().HasMany(a => a.Attachments).WithOne().HasForeignKey(a => a.ActivityId);
        m.Entity<Activity>().HasOne(a => a.AzureDevOpsSync).WithOne().HasForeignKey<AzureDevOpsSync>(a => a.ActivityId);
        m.Entity<ActivityTimeEntry>().Property(t => t.Version).IsRowVersion();
        m.Entity<ActivityTimeEntry>().HasIndex(t => new { t.ActivityId, t.UserId }).IsUnique().HasFilter("[EndedAt] IS NULL");
        m.Entity<Notification>().Property(n => n.DeduplicationKey).HasMaxLength(300); m.Entity<Notification>().HasIndex(n => n.DeduplicationKey).IsUnique();
        m.Entity<Role>().Property(r => r.Name).HasMaxLength(80); m.Entity<Role>().HasIndex(r => r.Name).IsUnique();
        m.Entity<User>().HasMany(u => u.Roles).WithMany().UsingEntity("UserRoles");
        m.Entity<AuditLog>().HasIndex(a => new { a.ActivityId, a.CreatedAt });
        m.Entity<Category>().HasData(
            new Category { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Segurança", Subcategories = ["Assessment", "Vulnerabilidade", "Hardening", "Compliance", "LGPD", "Auditoria"] },
            new Category { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "Infraestrutura", Subcategories = ["Azure", "Microsoft 365", "Active Directory", "Backup", "Virtualização"] },
            new Category { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Monitoramento", Subcategories = ["Netskope", "Sentinel", "Defender", "Firewall", "SIEM"] },
            new Category { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Projetos", Subcategories = ["Implementação", "Migração", "Atualização", "Melhoria"] },
            new Category { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Name = "Suporte", Subcategories = ["Incidente", "Problema", "Requisição"] });
        var names = new[] { "Admin", "Manager", "Analyst", "Reader" }; for (var i = 0; i < names.Length; i++) m.Entity<Role>().HasData(new Role { Id = Guid.Parse($"20000000-0000-0000-0000-{i + 1:000000000000}"), Name = names[i] });
        // IDs are assigned by the domain. New child objects added to tracked collections must be INSERTs.
        foreach (var entity in m.Model.GetEntityTypes().Where(t => typeof(Entity).IsAssignableFrom(t.ClrType)))
            m.Entity(entity.ClrType).Property(nameof(Entity.Id)).ValueGeneratedNever();
    }
}
