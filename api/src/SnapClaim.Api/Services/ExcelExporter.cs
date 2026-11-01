using System.Text.Json;
using ClosedXML.Excel;
using Dapper;
using Npgsql;
using SnapClaim.Api.Endpoints;

namespace SnapClaim.Api.Services;

/// <summary>
/// The month-end workbook the director reviews: every claim on one sheet with
/// a sign-off column, plus employee and category roll-ups.
/// </summary>
public sealed class ExcelExporter
{
    public async Task<byte[]> MonthWorkbook(NpgsqlConnection conn, Guid companyId, string period, string generatedBy)
    {
        var company = await conn.QuerySingleAsync<(string name, string currency)>("SELECT name, currency FROM company WHERE id = @companyId", new { companyId });
        var claims = (await conn.QueryAsync<ClaimEndpoints.ClaimRow>(
            ClaimEndpoints.ClaimSql + " WHERE c.company_id = @companyId AND c.period = @period AND c.status <> 'draft' ORDER BY e.full_name, c.spent_on, c.claim_no",
            new { companyId, period })).ToList();
        var managers = (await conn.QueryAsync<(Guid id, string name)>("SELECT id, full_name FROM app_user WHERE company_id = @companyId", new { companyId }))
            .ToDictionary(x => x.id, x => x.name);
        var close = await conn.QuerySingleOrDefaultAsync<(DateTime closed_at, string name)?>(
            "SELECT mc.closed_at, u.full_name FROM month_close mc JOIN app_user u ON u.id = mc.closed_by WHERE mc.company_id = @companyId AND mc.period = @period", new { companyId, period });

        using var wb = new XLWorkbook();
        var money = $"#,##0.00";

        // ---- Summary ----------------------------------------------------------
        var s = wb.Worksheets.Add("Summary");
        s.Cell(1, 1).Value = $"{company.name} · Expense claims · {MonthName(period)}";
        s.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        s.Cell(2, 1).Value = $"Generated {DateTime.UtcNow.AddHours(5.5):dd MMM yyyy HH:mm} IST by {generatedBy}";
        s.Cell(3, 1).Value = close is { } cl ? $"Month closed {cl.closed_at.AddHours(5.5):dd MMM yyyy HH:mm} IST by {cl.name}" : "Month not yet closed";
        var r = 5;
        s.Cell(r, 1).Value = "Status"; s.Cell(r, 2).Value = "Claims"; s.Cell(r, 3).Value = $"Amount ({company.currency})";
        s.Range(r, 1, r, 3).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#E8EEF9"));
        foreach (var status in new[] { "submitted", "approved", "cleared", "rejected" })
        {
            r++;
            var group = claims.Where(c => c.Status == status).ToList();
            s.Cell(r, 1).Value = Label(status);
            s.Cell(r, 2).Value = group.Count;
            s.Cell(r, 3).Value = group.Sum(c => c.Amount);
            s.Cell(r, 3).Style.NumberFormat.Format = money;
        }
        r++;
        s.Cell(r, 1).Value = "Total"; s.Cell(r, 2).Value = claims.Count; s.Cell(r, 3).Value = claims.Sum(c => c.Amount);
        s.Range(r, 1, r, 3).Style.Font.SetBold();
        s.Cell(r, 3).Style.NumberFormat.Format = money;
        r += 2;
        s.Cell(r, 1).Value = "Payable (approved + cleared)";
        s.Cell(r, 3).Value = claims.Where(c => c.Status is "approved" or "cleared").Sum(c => c.Amount);
        s.Cell(r, 3).Style.NumberFormat.Format = money;
        s.Range(r, 1, r, 3).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#E3F5E9"));
        s.Columns().AdjustToContents();

        // ---- Claims -----------------------------------------------------------
        var w = wb.Worksheets.Add("Claims");
        string[] headers =
        [
            "Claim #", "Employee", "Emp code", "Department", "Manager", "Spent on", "Category", "Vendor", "Title",
            $"Amount ({company.currency})", "Tax", "Currency", "Status", "Policy flags", "Receipts", "Submitted", "Decided by", "Decided at", "Decision note",
            "Director sign-off", "Director remarks",
        ];
        for (var i = 0; i < headers.Length; i++) w.Cell(1, i + 1).Value = headers[i];
        w.Range(1, 1, 1, headers.Length).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#2F6BFF")).Font.SetFontColor(XLColor.White);
        var row = 2;
        foreach (var c in claims)
        {
            var flags = JsonDocument.Parse(c.PolicyFlags).RootElement.EnumerateArray()
                .Select(f => f.TryGetProperty("message", out var m) ? m.GetString() : null).Where(x => x is not null).ToList();
            w.Cell(row, 1).Value = c.ClaimNo;
            w.Cell(row, 2).Value = c.EmployeeName;
            w.Cell(row, 3).Value = c.EmployeeCode;
            w.Cell(row, 4).Value = c.Department;
            w.Cell(row, 5).Value = c.ManagerId is { } m && managers.TryGetValue(m, out var mn) ? mn : "";
            w.Cell(row, 6).Value = c.SpentOn.ToDateTime(TimeOnly.MinValue);
            w.Cell(row, 6).Style.DateFormat.Format = "dd-MMM-yyyy";
            w.Cell(row, 7).Value = c.CategoryName ?? "";
            w.Cell(row, 8).Value = c.Vendor ?? "";
            w.Cell(row, 9).Value = c.Title;
            w.Cell(row, 10).Value = c.Amount;
            w.Cell(row, 10).Style.NumberFormat.Format = money;
            w.Cell(row, 11).Value = c.TaxAmount;
            w.Cell(row, 11).Style.NumberFormat.Format = money;
            w.Cell(row, 12).Value = c.Currency;
            w.Cell(row, 13).Value = Label(c.Status);
            w.Cell(row, 14).Value = string.Join("; ", flags);
            w.Cell(row, 15).Value = c.ReceiptCount;
            w.Cell(row, 16).Value = c.SubmittedAt?.AddHours(5.5);
            w.Cell(row, 16).Style.DateFormat.Format = "dd-MMM-yyyy HH:mm";
            w.Cell(row, 17).Value = c.DecidedByName ?? "";
            w.Cell(row, 18).Value = c.DecidedAt?.AddHours(5.5);
            w.Cell(row, 18).Style.DateFormat.Format = "dd-MMM-yyyy HH:mm";
            w.Cell(row, 19).Value = c.DecisionNote ?? "";
            w.Cell(row, 20).Value = c.Status == "cleared" ? "Cleared" : "";
            var fill = c.Status switch
            {
                "rejected" => "#FDE8E8", "submitted" => "#FFF4E0", "cleared" => "#E3F5E9", _ => (string?)null,
            };
            if (fill is not null) w.Range(row, 1, row, headers.Length).Style.Fill.SetBackgroundColor(XLColor.FromHtml(fill));
            if (flags.Count > 0) w.Cell(row, 14).Style.Font.SetFontColor(XLColor.FromHtml("#B45309"));
            row++;
        }
        if (claims.Count > 0)
        {
            w.Cell(row, 9).Value = "Total";
            w.Cell(row, 10).FormulaA1 = $"SUBTOTAL(9,J2:J{row - 1})";
            w.Cell(row, 10).Style.NumberFormat.Format = money;
            w.Range(row, 9, row, 10).Style.Font.SetBold();
            w.Range(1, 1, row - 1, headers.Length).SetAutoFilter();
        }
        w.SheetView.FreezeRows(1);
        w.Columns().AdjustToContents();
        w.Column(9).Width = Math.Min(w.Column(9).Width, 48);
        w.Column(14).Width = Math.Min(w.Column(14).Width, 60);
        w.Column(19).Width = Math.Min(w.Column(19).Width, 40);

        // ---- By employee ------------------------------------------------------
        var e = wb.Worksheets.Add("By employee");
        string[] eh = ["Employee", "Emp code", "Department", "Claims", "Pending", "Approved + cleared", "Rejected", "Pending amount"];
        for (var i = 0; i < eh.Length; i++) e.Cell(1, i + 1).Value = eh[i];
        e.Range(1, 1, 1, eh.Length).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#E8EEF9"));
        row = 2;
        foreach (var grp in claims.GroupBy(c => (c.EmployeeId, c.EmployeeName, c.EmployeeCode, c.Department)).OrderBy(g => g.Key.EmployeeName))
        {
            e.Cell(row, 1).Value = grp.Key.EmployeeName;
            e.Cell(row, 2).Value = grp.Key.EmployeeCode;
            e.Cell(row, 3).Value = grp.Key.Department;
            e.Cell(row, 4).Value = grp.Count();
            e.Cell(row, 5).Value = grp.Count(c => c.Status == "submitted");
            e.Cell(row, 6).Value = grp.Where(c => c.Status is "approved" or "cleared").Sum(c => c.Amount);
            e.Cell(row, 7).Value = grp.Where(c => c.Status == "rejected").Sum(c => c.Amount);
            e.Cell(row, 8).Value = grp.Where(c => c.Status == "submitted").Sum(c => c.Amount);
            foreach (var col in new[] { 6, 7, 8 }) e.Cell(row, col).Style.NumberFormat.Format = money;
            row++;
        }
        e.Columns().AdjustToContents();

        // ---- By category ------------------------------------------------------
        var k = wb.Worksheets.Add("By category");
        string[] kh = ["Category", "Claims", "Approved + cleared", "Pending amount", "Rejected"];
        for (var i = 0; i < kh.Length; i++) k.Cell(1, i + 1).Value = kh[i];
        k.Range(1, 1, 1, kh.Length).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#E8EEF9"));
        row = 2;
        foreach (var grp in claims.GroupBy(c => c.CategoryName ?? "Uncategorised").OrderByDescending(g => g.Where(c => c.Status is "approved" or "cleared").Sum(c => c.Amount)))
        {
            k.Cell(row, 1).Value = grp.Key;
            k.Cell(row, 2).Value = grp.Count();
            k.Cell(row, 3).Value = grp.Where(c => c.Status is "approved" or "cleared").Sum(c => c.Amount);
            k.Cell(row, 4).Value = grp.Where(c => c.Status == "submitted").Sum(c => c.Amount);
            k.Cell(row, 5).Value = grp.Where(c => c.Status == "rejected").Sum(c => c.Amount);
            foreach (var col in new[] { 3, 4, 5 }) k.Cell(row, col).Style.NumberFormat.Format = money;
            row++;
        }
        k.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static string Label(string status) => status switch
    {
        "submitted" => "Pending approval", "approved" => "Approved", "cleared" => "Cleared by director", "rejected" => "Rejected", _ => status,
    };

    private static string MonthName(string period)
        => DateOnly.ParseExact(period + "-01", "yyyy-MM-dd").ToString("MMMM yyyy");
}
