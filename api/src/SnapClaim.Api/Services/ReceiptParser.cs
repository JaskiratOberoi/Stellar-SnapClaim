using System.Globalization;
using System.Text.RegularExpressions;

namespace SnapClaim.Api.Services;

/// <summary>
/// Turns OCR lines into the claim fields. Receipts are not uniform, so this is
/// a set of ranked rules rather than a grammar: the grand total is the amount
/// on the strongest "total"-like line, the date is the first plausible date
/// (day first, as Indian receipts print it), the vendor is the biggest line
/// near the top that is not boilerplate, and the category comes from keywords.
/// The output keeps the shape the app already knows.
/// </summary>
public static partial class ReceiptParser
{
    public sealed record Item(string Description, decimal? Quantity, decimal? UnitPrice, decimal? Amount);
    public sealed record Extraction(
        bool IsReceipt, string? Vendor, string? SpentOn, string? Currency, decimal? Total, decimal? Tax,
        string? Category, string? InvoiceNo, List<Item> Lines, string Confidence, string? Notes);

    // "Rs.819.00" must yield 819.00: a dot only glues digits when a digit sits on both sides of it.
    [GeneratedRegex(@"(?<!\d)(?<!\d\.)(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?(?!\d)(?!\.\d)")]
    private static partial Regex Number();
    [GeneratedRegex(@"\S*/\S*|\b\d{1,2}:\d{2}(?::\d{2})?\b")]
    private static partial Regex NotMoney();
    [GeneratedRegex(@"\d+(?:\.\d+)?\s*%")]
    private static partial Regex Percent();
    // No trailing boundary: the recogniser often glues the time on, as in "2026-11-0309:31:58".
    [GeneratedRegex(@"(?<!\d)(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})")]
    private static partial Regex NumericDate();
    [GeneratedRegex(@"(?<!\d)(\d{4})-(\d{2})-(\d{2})")]
    private static partial Regex IsoDate();
    [GeneratedRegex(@"bi[l1i]{1,2}\s*no", RegexOptions.IgnoreCase)]
    private static partial Regex BillNoTypo();
    [GeneratedRegex(@"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?[\s\-,]+(\d{2}|\d{4})\b")]
    private static partial Regex DayMonthName();
    [GeneratedRegex(@"\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b")]
    private static partial Regex MonthNameDay();
    [GeneratedRegex(@"\b(?:invoice|inv|bill|receipt|order|txn|transaction|ref)\s*(?:no|num|number|#|id)?[\s.:#\-]*([A-Za-z0-9][A-Za-z0-9\-\/]{2,})", RegexOptions.IgnoreCase)]
    private static partial Regex InvoiceNo();
    [GeneratedRegex(@"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}\b")]
    private static partial Regex Gstin();
    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Gaps();
    [GeneratedRegex(@"^\s*(\d+(?:\.\d+)?)\s*[xX×*]\s*")]
    private static partial Regex LeadingQty();

    // Strongest first. A line matching an earlier pattern wins over a later one.
    private static readonly string[] TotalKeys =
        ["grand total", "net amount", "net payable", "amount payable", "total payable", "net total", "total amount", "amount paid", "bill amount", "balance due", "amount due", "total due", "payable", "total", "paid", "amount"];
    private static readonly string[] NotTotal = ["sub total", "subtotal", "sub-total", "total qty", "total items", "total quantity", "saving", "discount", "tax", "gst", "vat", "cess", "round", "tip", "change", "tender", "cash", "card", "upi"];
    private static readonly string[] TaxKeys = ["cgst", "sgst", "igst", "utgst", "vat", "service tax", "service charge", "gst", "tax"];
    private static readonly string[] Boilerplate =
    [
        "tax invoice", "invoice", "receipt", "bill", "cash memo", "retail", "original", "duplicate", "customer copy", "welcome", "thank", "gstin", "gst no", "fssai", "pan ", "tin ", "cin:", "cin ", "sac:", "phone", "ph:", "ph.", "tel", "mob", "www.", ".com", "date", "time", "table", "cashier", "counter", "order", "token", "kot", "covers", "guests", "pax", "qty", "type:", "powered by",
    ];
    private static readonly string[] TaxComponents = ["cgst", "sgst", "igst", "utgst"];

    private static readonly (string code, string[] words)[] CategoryWords =
    [
        ("fuel", ["petrol", "diesel", "fuel", "indian oil", "indianoil", "iocl", "bharat petroleum", "bpcl", "hpcl", "hp petrol", "nayara", "shell", "litre", "ltr", "cng", "filling station", "pump"]),
        ("accommodation", ["room", "check-in", "check in", "check-out", "check out", "night", "lodging", "stay", "tariff", "oyo", "marriott", "taj ", "hyatt", "radisson", "lemon tree", "treebo", "fabhotel", "guest house", "resort", "accommodation"]),
        ("travel", ["uber", "ola ", "rapido", "taxi", "cab", "auto", "irctc", "railway", "train", "pnr", "flight", "airline", "indigo", "air india", "vistara", "spicejet", "akasa", "redbus", "bus ", "toll", "parking", "metro", "fare", "ticket", "boarding", "travel"]),
        ("meals", ["restaurant", "cafe", "café", "coffee", "food", "swiggy", "zomato", "kitchen", "dhaba", "pizza", "burger", "biryani", "thali", "dosa", "meal", "lunch", "dinner", "breakfast", "snack", "bakery", "juice", "tea ", "chai", "bistro", "eatery", "canteen", "bar "]),
        ("communication", ["airtel", "jio", "vodafone", "vi ", "bsnl", "recharge", "broadband", "postpaid", "prepaid", "data plan", "mobile bill", "telecom", "internet"]),
        ("software", ["subscription", "license", "licence", "saas", "google workspace", "google cloud", "microsoft", "adobe", "aws", "amazon web services", "cloud", "domain", "hosting", "github", "zoom", "slack", "notion", "figma", "openai", "software"]),
        ("supplies", ["stationery", "stationary", "paper", "pen ", "pens", "cartridge", "toner", "printer", "amazon", "flipkart", "office", "supplies", "notebook", "folder", "stapler", "marker"]),
        ("client", ["banquet", "entertainment", "client", "gift", "hamper", "bouquet"]),
    ];

    public static Extraction Parse(IReadOnlyList<ReceiptExtractor.OcrLine> raw, int height, IReadOnlyList<(string code, string name)> categories, string companyCurrency)
    {
        var lines = raw.Select(l => new Line(Gaps().Replace(l.Text.Trim(), "  "), l.Score, l.Box)).Where(l => l.Text.Length > 0).ToList();
        var text = string.Join("\n", lines.Select(l => l.Text));
        var lower = text.ToLowerInvariant();
        var notes = new List<string>();

        var (total, totalIndex) = FindTotal(lines);
        var tax = FindTax(lines);
        var date = FindDate(lines);
        var vendor = FindVendor(lines, height);
        var invoice = FindInvoice(lines);
        var currency = FindCurrency(lower, companyCurrency);
        var category = GuessCategory(lower, categories);
        var items = totalIndex is { } ti ? FindItems(lines, ti, total) : [];

        var amounts = lines.Sum(l => Number().Matches(l.Text).Count);
        var isReceipt = lines.Count >= 3 && (total is not null || date is not null || amounts >= 2);
        if (!isReceipt)
            return new(false, null, null, null, null, null, null, null, [], "low", lines.Count == 0 ? "No printed text was found in the image." : "This does not look like a bill: no amounts or date were found.");

        if (total is null) notes.Add("the total");
        if (date is null) notes.Add("the date");
        if (vendor is null) notes.Add("the vendor");
        var meanScore = lines.Count == 0 ? 0 : lines.Average(l => l.Score);
        var confidence = notes.Count == 0 && meanScore >= 0.9 ? "high" : total is not null ? "medium" : "low";
        var note = notes.Count == 0
            ? (meanScore < 0.85 ? "Some text was hard to read; check the figures." : null)
            : $"Could not read {Join(notes)}; fill that in by hand.";

        return new(true, vendor, date, currency, total, tax ?? (total is null ? null : 0m), category, invoice, items, confidence, note);
    }

    private sealed record Line(string Text, double Score, double[][] Box)
    {
        public string Lower { get; } = Text.ToLowerInvariant();
        /// <summary>Lower-cased with spaces removed: the recogniser often prints "GRANDTOTAL" for large bold text.</summary>
        public string Squashed { get; } = Text.ToLowerInvariant().Replace(" ", "");
        public double Top => Box.Min(p => p[1]);
        public double Height => Box.Max(p => p[1]) - Top;
        public bool Has(string key) => Squashed.Contains(key.Replace(" ", ""));
        public bool HasAny(IEnumerable<string> keys) => keys.Any(Has);
    }

    private static string Join(List<string> parts) => parts.Count switch
    {
        1 => parts[0],
        2 => $"{parts[0]} and {parts[1]}",
        _ => string.Join(", ", parts.Take(parts.Count - 1)) + " and " + parts[^1],
    };

    /// <summary>Amounts on a line, ignoring percentages and GSTIN-like runs. Last one is usually the money column.</summary>
    private static List<decimal> Amounts(string text)
    {
        // Drop what is never money: GSTINs, percentages, dates, times and slash-joined codes such as CCD/2026/0142.
        var cleaned = NumericDate().Replace(NotMoney().Replace(Percent().Replace(Gstin().Replace(text, " "), " "), " "), " ");
        var list = new List<decimal>();
        foreach (Match m in Number().Matches(cleaned))
        {
            var s = m.Groups[1].Value.Replace(",", "") + (m.Groups[2].Success ? "." + m.Groups[2].Value : "");
            if (decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var v) && v < 10_000_000m) list.Add(v);
        }
        return list;
    }

    private static (decimal? total, int? index) FindTotal(List<Line> lines)
    {
        decimal? best = null;
        int? bestIndex = null;
        var bestRank = int.MaxValue;
        for (var i = 0; i < lines.Count; i++)
        {
            var l = lines[i];
            if (l.HasAny(NotTotal) && !l.Has("grand total") && !l.Has("net")) continue;
            var rank = Array.FindIndex(TotalKeys, l.Has);
            if (rank < 0) continue;
            var amounts = Amounts(l.Text);
            // "TOTAL" alone with the figure on the next line is common on thermal prints.
            if (amounts.Count == 0 && i + 1 < lines.Count && Letters(lines[i + 1].Text) == 0) amounts = Amounts(lines[i + 1].Text);
            if (amounts.Count == 0) continue;
            var amount = amounts[^1];
            if (amount <= 0) continue;
            // A stronger keyword wins; among equals the larger figure (grand total ≥ subtotal).
            if (rank < bestRank || (rank == bestRank && amount > best))
            {
                best = amount;
                bestRank = rank;
                bestIndex = i;
            }
        }
        if (best is not null) return (best, bestIndex);
        // No keyword: the largest figure printed with paise is the best guess.
        var candidates = lines.SelectMany((l, i) => Amounts(l.Text).Where(a => a != Math.Floor(a) || a >= 10).Select(a => (a, i))).ToList();
        if (candidates.Count == 0) return (null, null);
        var top = candidates.MaxBy(c => c.a);
        return (top.a, top.i);
    }

    private static decimal? FindTax(List<Line> lines)
    {
        // A printed "total tax" wins; else the CGST/SGST/IGST components, which bills print
        // under a "GST 5%" line that would otherwise be counted twice; else plain GST/VAT lines.
        decimal? totalTax = null;
        var components = new List<decimal>();
        var wholes = new List<decimal>();
        foreach (var l in lines)
        {
            if (l.Has("gstin") || l.Has("gst no") || l.Has("gst #") || l.Has("gst number") || l.Has("taxable") || l.Has("incl")) continue;
            if (!l.HasAny(TaxKeys)) continue;
            var amounts = Amounts(l.Text);
            if (amounts.Count == 0) continue;
            var amount = amounts[^1];
            if (l.Has("total tax") || l.Has("total gst") || l.Has("tax total") || l.Has("gst total")) totalTax = amount;
            else if (l.HasAny(TaxComponents)) components.Add(amount);
            else wholes.Add(amount);
        }
        if (totalTax is not null) return totalTax;
        if (components.Count > 0) return components.Sum();
        return wholes.Count == 0 ? null : wholes.Sum();
    }

    private static string? FindDate(List<Line> lines)
    {
        // Lines that say "date" first, then anything else, top to bottom.
        foreach (var l in lines.Where(l => l.Has("date") || l.Has("dt.") || l.Has("dt:")).Concat(lines))
            if (DateIn(l.Text) is { } d) return d;
        return null;
    }

    private static string? DateIn(string text)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5));
        foreach (Match m in IsoDate().Matches(text))
            if (Valid(int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[3].Value), today) is { } d) return d;
        foreach (Match m in NumericDate().Matches(text))
        {
            var a = int.Parse(m.Groups[1].Value);
            var b = int.Parse(m.Groups[2].Value);
            var y = Year(m.Groups[3].Value);
            // Day first as printed in India; fall back to month first when the day slot cannot be a month.
            if (Valid(y, b, a, today) is { } dmy) return dmy;
            if (Valid(y, a, b, today) is { } mdy) return mdy;
        }
        foreach (Match m in DayMonthName().Matches(text))
            if (MonthOf(m.Groups[2].Value) is { } mo && Valid(Year(m.Groups[3].Value), mo, int.Parse(m.Groups[1].Value), today) is { } d) return d;
        foreach (Match m in MonthNameDay().Matches(text))
            if (MonthOf(m.Groups[1].Value) is { } mo && Valid(int.Parse(m.Groups[3].Value), mo, int.Parse(m.Groups[2].Value), today) is { } d) return d;
        return null;
    }

    private static int Year(string s) => s.Length == 2 ? 2000 + int.Parse(s) : int.Parse(s);

    private static int? MonthOf(string name)
    {
        var n = name.ToLowerInvariant();
        string[] months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        var i = Array.FindIndex(months, m => n.StartsWith(m));
        if (i < 0 || (n.Length > 3 && !CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(i + 1).StartsWith(n, StringComparison.OrdinalIgnoreCase) && n != "sept")) return null;
        return i + 1;
    }

    private static string? Valid(int y, int m, int d, DateOnly today)
    {
        if (m is < 1 or > 12 || d < 1 || d > DateTime.DaysInMonth(Math.Clamp(y, 1, 9999), m)) return null;
        var date = new DateOnly(y, m, d);
        if (date > today.AddDays(1) || date < today.AddYears(-3)) return null;
        return date.ToString("yyyy-MM-dd");
    }

    private static int Letters(string s) => s.Count(char.IsLetter);

    private static string? FindVendor(List<Line> lines, int height)
    {
        // The name is printed at the top, usually bigger than the rest.
        var top = lines.Where(l => height <= 0 || l.Top < height * 0.35).Take(8)
            .Where(l => Letters(l.Text) >= 3 && Letters(l.Text) > l.Text.Count(char.IsDigit) && !l.HasAny(Boilerplate) && !Gstin().IsMatch(l.Text) && DateIn(l.Text) is null)
            .ToList();
        if (top.Count == 0) return null;
        var tallest = top.MaxBy(l => l.Height)!;
        var first = top[0];
        // Prefer the first line unless something clearly larger follows within the next few lines.
        var pick = tallest.Height > first.Height * 1.3 ? tallest : first;
        var name = pick.Text.Split("  ")[0].Trim(' ', '*', '-', '_', '=', ':', '|');
        return name.Length < 2 ? null : (name.ToUpperInvariant() == name ? CultureInfo.InvariantCulture.TextInfo.ToTitleCase(name.ToLowerInvariant()) : name);
    }

    private static string? FindInvoice(List<Line> lines)
    {
        foreach (var l in lines)
        {
            if (l.Has("gstin")) continue;
            var m = InvoiceNo().Match(BillNoTypo().Replace(l.Text.Replace("InvoiceNo", "Invoice No"), "Bill No"));
            if (!m.Success) continue;
            var v = m.Groups[1].Value.Trim('-', '/', '.');
            if (v.Length >= 3 && v.Any(char.IsDigit) && DateIn(v) is null) return v;
        }
        return null;
    }

    private static string FindCurrency(string lower, string fallback)
    {
        if (lower.Contains('₹') || lower.Contains("rs.") || lower.Contains("rs ") || lower.Contains("inr") || lower.Contains("rupee")) return "INR";
        if (lower.Contains("usd") || lower.Contains("us$")) return "USD";
        if (lower.Contains("aed") || lower.Contains("dirham")) return "AED";
        if (lower.Contains("eur") || lower.Contains('€')) return "EUR";
        if (lower.Contains("gbp") || lower.Contains('£')) return "GBP";
        if (lower.Contains("sgd")) return "SGD";
        if (lower.Contains('$')) return "USD";
        return fallback;
    }

    private static string? GuessCategory(string lower, IReadOnlyList<(string code, string name)> categories)
    {
        var known = categories.Select(c => c.code).ToHashSet();
        string? best = null;
        var bestScore = 0;
        foreach (var (code, words) in CategoryWords)
        {
            if (!known.Contains(code)) continue;
            var score = words.Sum(w => lower.Contains(w) ? (w.Length >= 6 ? 2 : 1) : 0);
            if (score > bestScore)
            {
                best = code;
                bestScore = score;
            }
        }
        return best;
    }

    private static List<Item> FindItems(List<Line> lines, int totalIndex, decimal? total)
    {
        var items = new List<Item>();
        var start = Math.Max(0, totalIndex - 25);
        for (var i = start; i < totalIndex; i++)
        {
            var l = lines[i];
            if (l.HasAny(TaxKeys) || l.HasAny(NotTotal) || TotalKeys.Any(k => k != "amount" && l.Has(k)) || l.HasAny(Boilerplate)) continue;
            var amounts = Amounts(l.Text);
            if (amounts.Count == 0 || Letters(l.Text) < 3) continue;
            var amount = amounts[^1];
            if (amount <= 0 || (total is { } t && amount > t)) continue;
            var desc = l.Text;
            decimal? qty = null;
            var q = LeadingQty().Match(desc);
            if (q.Success) { qty = decimal.Parse(q.Groups[1].Value, CultureInfo.InvariantCulture); desc = desc[q.Length..]; }
            // "Item  Qty  Amt" layout: a small whole number just before the amount is the quantity.
            else if (amounts.Count >= 2 && amounts[^2] is var mid && mid == Math.Floor(mid) && mid is >= 1 and <= 100 && mid < amount) qty = mid;
            // A bare small whole number with no paise is a count (covers, table), not money.
            if (amounts.Count == 1 && amount == Math.Floor(amount) && amount < 10) continue;
            // Drop the figures from the description: keep the words.
            desc = Number().Replace(desc, " ").Trim();
            desc = Gaps().Replace(desc, " ").Trim(' ', '-', ':', '.', '|');
            if (desc.Length < 2) continue;
            decimal? unit = qty is { } qn && qn > 0
                ? (q.Success && amounts.Count >= 2 && Math.Abs(amounts[^2] * qn - amount) < 0.05m ? amounts[^2] : (amount / qn) is var u && u == Math.Round(u, 2) ? u : null)
                : null;
            items.Add(new(desc.Length > 60 ? desc[..60] : desc, qty, unit, amount));
            if (items.Count >= 20) break;
        }
        return items;
    }
}
