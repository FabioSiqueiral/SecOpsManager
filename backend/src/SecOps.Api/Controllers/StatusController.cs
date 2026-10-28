using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace SecOps.Api.Controllers;

[ApiController, Route("api/status")]
public partial class StatusController(IHttpClientFactory httpClientFactory) : ControllerBase
{
    const int MaxItems = 5000;
    static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    [HttpPost("check")]
    public async Task<StatusCheckResponse> Check(StatusCheckRequest request, CancellationToken ct)
    {
        var raw = (request.Items ?? []).Select(i => i?.Trim()).Where(i => !string.IsNullOrWhiteSpace(i)).Select(i => i!).ToArray();
        if (raw.Length > MaxItems) throw new ArgumentException($"Limite de consulta: {MaxItems} itens por vez.");

        var unique = raw.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var invalid = new List<InvalidStatusItem>();
        var valid = new List<ParsedItem>();

        foreach (var item in unique)
        {
            var parsed = Parse(item);
            if (parsed == null) invalid.Add(new InvalidStatusItem(item, "Formato inválido."));
            else valid.Add(parsed);
        }

        var options = new ParallelOptions { MaxDegreeOfParallelism = Math.Clamp(request.Concurrency ?? 25, 1, 100), CancellationToken = ct };
        var results = new List<StatusCheckResult>();
        await Parallel.ForEachAsync(valid, options, async (item, token) =>
        {
            var result = item.Type == "IP"
                ? await CheckIp(item.Value, request.IpMethod, request.TcpPort, token)
                : await CheckHttp(item.Value, item.Type, token);
            lock (results) results.Add(result);
        });

        return new StatusCheckResponse(results.OrderBy(r => Array.IndexOf(unique, r.Item)).ToArray(), invalid.ToArray());
    }

    static ParsedItem? Parse(string item)
    {
        if (IPAddress.TryParse(item, out _)) return new ParsedItem(item, "IP", item);
        if (Uri.TryCreate(item, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" && !string.IsNullOrWhiteSpace(uri.Host))
            return new ParsedItem(item, "URL", item);
        if (!item.Contains("://") && DomainRegex().IsMatch(item)) return new ParsedItem(item, "Domínio", $"https://{item}");
        return null;
    }

    async Task<StatusCheckResult> CheckHttp(string item, string type, CancellationToken ct)
    {
        var target = type == "Domínio" ? $"https://{item}" : item;
        var startedAt = DateTimeOffset.UtcNow;
        var sw = Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(Timeout);
            using var request = new HttpRequestMessage(HttpMethod.Get, target);
            request.Headers.UserAgent.ParseAdd("SecOpsManager/1.0");
            using var response = await httpClientFactory.CreateClient().SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            sw.Stop();
            return new StatusCheckResult(item, type, "Online", (int)response.StatusCode, sw.ElapsedMilliseconds, startedAt, null);
        }
        catch
        {
            sw.Stop();
            if (type == "Domínio" && target.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                return await CheckHttp("http://" + item, "URL", ct) with { Item = item, Type = type };
            return new StatusCheckResult(item, type, "Offline", null, sw.ElapsedMilliseconds, startedAt, null);
        }
    }

    static async Task<StatusCheckResult> CheckIp(string ip, string? method, int? tcpPort, CancellationToken ct)
    {
        var startedAt = DateTimeOffset.UtcNow;
        var sw = Stopwatch.StartNew();
        var tcp = string.Equals(method, "tcp", StringComparison.OrdinalIgnoreCase);
        try
        {
            if (tcp)
            {
                using var client = new TcpClient();
                await client.ConnectAsync(IPAddress.Parse(ip), tcpPort is > 0 and <= 65535 ? tcpPort.Value : 443).WaitAsync(Timeout, ct);
            }
            else
            {
                using var ping = new Ping();
                var reply = await ping.SendPingAsync(ip, (int)Timeout.TotalMilliseconds);
                if (reply.Status != IPStatus.Success) throw new InvalidOperationException(reply.Status.ToString());
            }
            sw.Stop();
            return new StatusCheckResult(ip, "IP", "Online", null, sw.ElapsedMilliseconds, startedAt, null);
        }
        catch
        {
            sw.Stop();
            return new StatusCheckResult(ip, "IP", "Offline", null, sw.ElapsedMilliseconds, startedAt, null);
        }
    }

    [GeneratedRegex(@"^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$")]
    private static partial Regex DomainRegex();

    sealed record ParsedItem(string Item, string Type, string Value);
}

public sealed record StatusCheckRequest(string[]? Items, string? IpMethod, int? TcpPort, int? Concurrency);
public sealed record StatusCheckResponse(StatusCheckResult[] Results, InvalidStatusItem[] Invalid);
public sealed record StatusCheckResult(string Item, string Type, string Status, int? HttpCode, long ResponseTimeMs, DateTimeOffset CheckedAt, string? Error);
public sealed record InvalidStatusItem(string Item, string Reason);
