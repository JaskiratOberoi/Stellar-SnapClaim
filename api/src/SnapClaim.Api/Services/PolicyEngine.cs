using Dapper;
using Npgsql;

namespace SnapClaim.Api.Services;

/// <summary>
/// Auto-verification: checks a claim against the company spending policy and
/// returns flags. "block" flags stop submission; "warn" flags travel with the
/// claim so the manager sees exactly why it needs a closer look.
/// </summary>
public static class PolicyEngine
{
    public sealed record Flag(string Code, string Message, string Severity);

    public sealed record CheckRequest(Guid? ClaimId, Guid? CategoryId, decimal Amount, DateOnly SpentOn, bool HasReceipt, string? Vendor);

    private sealed class Rule
    {
        public Guid? CategoryId { get; set; }
        public decimal? MaxPerClaim { get; set; }
        public decimal? MaxPerMonth { get; set; }
        public decimal ReceiptRequiredAbove { get; set; }
        public int? MaxDaysToSubmit { get; set; }
    }

    public static async Task<List<Flag>> Evaluate(
        NpgsqlConnection conn, Guid companyId, Guid employeeId, Guid? claimId, Guid? categoryId,
        decimal amount, DateOnly spentOn, bool hasReceipt, string? vendor)
    {
        var flags = new List<Flag>();
        var rules = (await conn.QueryAsync<Rule>(
            "SELECT category_id, max_per_claim, max_per_month, receipt_required_above, max_days_to_submit FROM policy_rule WHERE company_id = @companyId AND (category_id IS NULL OR category_id = @categoryId)",
            new { companyId, categoryId })).ToList();
        var company = rules.FirstOrDefault(r => r.CategoryId is null);
        var specific = categoryId is null ? null : rules.FirstOrDefault(r => r.CategoryId == categoryId);

        // The category rule wins field by field; the company rule fills the gaps.
        var maxPerClaim = specific?.MaxPerClaim ?? company?.MaxPerClaim;
        var maxPerMonth = specific?.MaxPerMonth ?? company?.MaxPerMonth;
        var receiptAbove = specific?.ReceiptRequiredAbove ?? company?.ReceiptRequiredAbove ?? 0;
        var maxDays = specific?.MaxDaysToSubmit ?? company?.MaxDaysToSubmit;

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5)); // company day in IST; good enough for a date check

        if (spentOn > today)
            flags.Add(new("future_date", $"Spend date {spentOn:dd MMM yyyy} is in the future", "block"));

        if (amount > receiptAbove && !hasReceipt)
            flags.Add(new("receipt_missing", $"A receipt is required for claims above {receiptAbove:N0}", "block"));

        if (maxPerClaim is { } cap && amount > cap)
            flags.Add(new("over_claim_cap", $"Amount {amount:N2} exceeds the per-claim limit of {cap:N0}", "warn"));

        if (maxDays is { } days && spentOn.AddDays(days) < today)
            flags.Add(new("late_submission", $"Spent {(today.DayNumber - spentOn.DayNumber)} days ago; policy allows {days} days", "warn"));

        if (maxPerMonth is { } monthCap)
        {
            var monthTotal = await conn.ExecuteScalarAsync<decimal>("""
                SELECT coalesce(sum(amount), 0) FROM claim
                WHERE employee_id = @employeeId AND period = @period AND status <> 'rejected' AND status <> 'draft'
                  AND (@claimId::uuid IS NULL OR id <> @claimId)
                  AND (@categoryId::uuid IS NULL OR @specific = false OR category_id = @categoryId)
                """, new { employeeId, period = spentOn.ToString("yyyy-MM"), claimId, categoryId, specific = specific?.MaxPerMonth is not null });
            if (monthTotal + amount > monthCap)
                flags.Add(new("over_month_cap", $"This takes the month to {monthTotal + amount:N2}, above the limit of {monthCap:N0}", "warn"));
        }

        if (!string.IsNullOrWhiteSpace(vendor))
        {
            var dup = await conn.ExecuteScalarAsync<int>("""
                SELECT count(*) FROM claim
                WHERE employee_id = @employeeId AND spent_on = @spentOn AND amount = @amount AND lower(vendor) = lower(@vendor)
                  AND status <> 'rejected' AND (@claimId::uuid IS NULL OR id <> @claimId)
                """, new { employeeId, spentOn, amount, vendor = vendor.Trim(), claimId });
            if (dup > 0)
                flags.Add(new("possible_duplicate", $"Another claim for {vendor.Trim()} on {spentOn:dd MMM} for the same amount exists", "warn"));
        }

        return flags;
    }
}
