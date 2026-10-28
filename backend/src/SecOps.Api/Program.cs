using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SecOps.Application;
using SecOps.Infrastructure;
using SecOps.Api;
var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false).AddEnvironmentVariables();
builder.Logging.ClearProviders(); builder.Logging.AddJsonConsole();
builder.Services.AddHttpContextAccessor(); builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddDbContext<SecOpsDbContext>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));
builder.Services.AddScoped<IActivityRepository, ActivityRepository>(); builder.Services.AddScoped<IActivityJournal, ActivityJournal>(); builder.Services.AddScoped<IActivityService, ActivityService>();
builder.Services.AddHttpClient<IAiService, AiService>(c => c.Timeout = TimeSpan.FromSeconds(60)); builder.Services.AddSingleton<IAzureDevOpsService, AzureDevOpsService>(); builder.Services.AddHostedService<NotificationWorker>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false; var tenant = builder.Configuration["Entra:TenantId"]; var client = builder.Configuration["Entra:ApiClientId"];
    o.Authority = $"https://login.microsoftonline.com/{tenant}/v2.0"; o.Audience = client;
    o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, RoleClaimType = "roles", NameClaimType = "name", ValidAudience = client };
});
builder.Services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().RequireRole("Admin", "Manager", "Analyst", "Reader")
        .RequireAssertion(c => c.User.FindFirst("scp")?.Value.Split(' ').Contains("access_as_user") == true && Guid.TryParse(c.User.FindFirst("oid")?.Value, out _)).Build();
    o.AddPolicy("Write", p => p.RequireRole("Admin", "Manager", "Analyst")); o.AddPolicy("Manage", p => p.RequireRole("Admin", "Manager")); o.AddPolicy("Admin", p => p.RequireRole("Admin"));
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(builder.Configuration["FrontendUrl"] ?? "http://localhost:3300").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer(); builder.Services.AddSwaggerGen(o => { o.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme { Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" }); o.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement { { new Microsoft.OpenApi.Models.OpenApiSecurityScheme { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() } }); }); builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c => RateLimitPartition.GetFixedWindowLimiter(c.User.FindFirst("oid")?.Value ?? c.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new() { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })); });
var app = builder.Build();
if (args.Contains("--migrate")) { using var scope = app.Services.CreateScope(); await scope.ServiceProvider.GetRequiredService<SecOpsDbContext>().Database.MigrateAsync(); return; }
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var ex = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()!.Error;
    var status = ex switch { KeyNotFoundException => 404, ArgumentException => 400, DbUpdateConcurrencyException => 409, DbUpdateException => 409, InvalidOperationException => 422, NotSupportedException => 501, OperationCanceledException => 408, _ => 500 };
    app.Logger.LogError(ex, "Request failed {TraceId}", context.TraceIdentifier);
    var title = ex is ArgumentException or KeyNotFoundException or NotSupportedException ? ex.Message : status == 409 ? "Dados alterados por outra operação. Atualize e tente novamente." : ex is InvalidOperationException ? ex.Message : "Não foi possível concluir a operação.";
    await Results.Problem(statusCode: status, title: title, extensions: new Dictionary<string, object?> { { "traceId", context.TraceIdentifier } }).ExecuteAsync(context);
}));
app.Use(async (c, next) => { c.Response.Headers["X-Content-Type-Options"] = "nosniff"; c.Response.Headers["Cache-Control"] = "no-store"; await next(); });
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseCors(); app.UseAuthentication(); app.UseRateLimiter(); app.UseAuthorization();
// Apply the baseline policy even when an action has an additional role policy.
app.MapControllers().RequireAuthorization(app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<AuthorizationOptions>>().Value.FallbackPolicy!);
app.MapGet("/health/live", () => Results.Ok(new { status = "live" })).AllowAnonymous();

app.Run();
public partial class Program;
