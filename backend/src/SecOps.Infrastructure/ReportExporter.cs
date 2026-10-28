using System.Text;
using ClosedXML.Excel;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
using SecOps.Application;
namespace SecOps.Infrastructure;
public static class ReportExporter
{
    public static string Safe(string value) => value.TrimStart() is { Length: > 0 } s && "=+-@".Contains(s[0]) || value.StartsWith('\t') || value.StartsWith('\r') || value.StartsWith('\n') ? "'" + value : value;
    public static ReportFile Export(string title, string[] headers, IReadOnlyList<string[]> rows, string format)
    {
        if (format == "csv") { string CsvLine(IEnumerable<string> cols) => string.Join(';', cols.Select(v => "\"" + Safe(v).Replace("\"", "\"\"") + "\"")); var text = CsvLine(headers) + "\r\n" + string.Join("\r\n", rows.Select(CsvLine)); return new(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(text)).ToArray(), "text/csv; charset=utf-8", "csv"); }
        if (format == "xlsx") { using var book = new XLWorkbook(); var sheet = book.AddWorksheet("Relatório"); for (var c = 0; c < headers.Length; c++) sheet.Cell(1, c + 1).Value = headers[c]; for (var r = 0; r < rows.Count; r++) for (var c = 0; c < rows[r].Length; c++) sheet.Cell(r + 2, c + 1).Value = Safe(rows[r][c]); sheet.Row(1).Style.Font.Bold = true; sheet.SheetView.FreezeRows(1); sheet.Columns().Width = 24; using var ms = new MemoryStream(); book.SaveAs(ms); return new(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"); }
        if (format != "pdf") throw new ArgumentException("Formato inválido.");
        lock (FontLock) { GlobalFontSettings.FontResolver ??= new FontResolver(); }
        using var doc = new PdfDocument(); doc.Info.Title = title; var font = new XFont("SecOps", 10); XGraphics? gfx = null; double y = 800;
        void Line(string line) { var text = line.Replace('\n', ' ').Replace('\r', ' '); do { if (y > 780) { gfx?.Dispose(); var page = doc.AddPage(); page.Size = PdfSharp.PageSize.A4; gfx = XGraphics.FromPdfPage(page); gfx.DrawString("SecOps Manager · " + title, font, XBrushes.DarkCyan, new XPoint(35, 30)); y = 55; } var count = text.Length; while (count > 1 && gfx!.MeasureString(text[..count], font).Width > 520) count--; gfx!.DrawString(text[..count], font, XBrushes.Black, new XPoint(35, y)); y += 15; text = text[count..]; } while (text.Length > 0); }
        if (rows.Count == 0) Line("Nenhum resultado."); foreach (var row in rows) { for (var c = 0; c < headers.Length; c++) Line(headers[c] + ": " + row[c]); y += 12; }
        gfx?.Dispose(); using var output = new MemoryStream(); doc.Save(output, false); return new(output.ToArray(), "application/pdf", "pdf");
    }
    private static readonly object FontLock = new();
    private sealed class FontResolver : IFontResolver { public FontResolverInfo ResolveTypeface(string familyName, bool bold, bool italic) => new("regular"); public byte[] GetFont(string faceName) => File.ReadAllBytes(OperatingSystem.IsWindows() ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Fonts), "arial.ttf") : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"); }
}
