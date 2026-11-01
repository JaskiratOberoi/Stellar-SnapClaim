using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;

namespace SnapClaim.Api.Services;

/// <summary>
/// Snap &amp; Extract: sends the receipt image to Claude with a JSON schema and
/// gets back vendor, date, totals, tax, currency, line items and a suggested
/// category. Runs on the server with the company's key so employees never
/// need one. With no key configured, extraction is skipped and the form is
/// filled by hand.
/// </summary>
public sealed class ReceiptExtractor(SnapClaimOptions options, ILogger<ReceiptExtractor> log)
{
    public bool Enabled => !string.IsNullOrWhiteSpace(options.AnthropicApiKey);
    public string Model => options.ClaudeModel;

    private readonly AnthropicClient? _client = string.IsNullOrWhiteSpace(options.AnthropicApiKey)
        ? null
        : new AnthropicClient { ApiKey = options.AnthropicApiKey };

    public static readonly string[] ImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    public static bool Supports(string contentType) => ImageTypes.Contains(contentType) || contentType == "application/pdf";

    public sealed record Result(JsonElement? Extraction, string? Error);

    public async Task<Result> Extract(byte[] data, string contentType, IReadOnlyList<(string code, string name)> categories, string companyCurrency, CancellationToken ct)
    {
        if (_client is null) return new(null, "extraction_disabled");
        if (!Supports(contentType)) return new(null, "unsupported_type");

        var codes = categories.Select(c => c.code).ToArray();
        var categoryList = string.Join(", ", categories.Select(c => $"{c.code} = {c.name}"));
        var base64 = Convert.ToBase64String(data);

        ContentBlockParam attachment = contentType == "application/pdf"
            ? new DocumentBlockParam { Source = new Base64PdfSource { Data = base64 } }
            : new ImageBlockParam { Source = new Base64ImageSource { Data = base64, MediaType = contentType } };

        var schema = new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
            ["properties"] = JsonSerializer.SerializeToElement(new Dictionary<string, object>
            {
                ["is_receipt"] = new { type = "boolean", description = "false when the image is not a bill, invoice or receipt" },
                ["vendor"] = new { type = new[] { "string", "null" }, description = "Merchant or vendor name as printed" },
                ["spent_on"] = new { type = new[] { "string", "null" }, description = "Date of the transaction as YYYY-MM-DD" },
                ["currency"] = new { type = new[] { "string", "null" }, description = "ISO 4217 code, e.g. INR" },
                ["total"] = new { type = new[] { "number", "null" }, description = "Grand total actually paid, inclusive of tax" },
                ["tax"] = new { type = new[] { "number", "null" }, description = "Total tax (GST/VAT/service tax) included in the total; 0 if none printed" },
                ["category"] = new { type = new[] { "string", "null" }, @enum = codes.Concat([null!]).ToArray(), description = "Best matching expense category code" },
                ["invoice_no"] = new { type = new[] { "string", "null" } },
                ["lines"] = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        properties = new Dictionary<string, object>
                        {
                            ["description"] = new { type = "string" },
                            ["quantity"] = new { type = new[] { "number", "null" } },
                            ["unit_price"] = new { type = new[] { "number", "null" } },
                            ["amount"] = new { type = new[] { "number", "null" } },
                        },
                        required = new[] { "description", "quantity", "unit_price", "amount" },
                    },
                },
                ["confidence"] = new { type = "string", @enum = new[] { "high", "medium", "low" } },
                ["notes"] = new { type = new[] { "string", "null" }, description = "Anything the employee should double-check" },
            }),
            ["required"] = JsonSerializer.SerializeToElement(new[] { "is_receipt", "vendor", "spent_on", "currency", "total", "tax", "category", "invoice_no", "lines", "confidence", "notes" }),
        };

        var instructions = $"""
            Read this expense receipt for an employee reimbursement claim and extract its details.
            Rules:
            - Copy the vendor name as printed; do not guess a brand from a logo you cannot read.
            - spent_on is the transaction date in YYYY-MM-DD. Indian receipts usually print DD/MM/YYYY or DD-MM-YY.
            - total is the amount actually paid (grand total after tax, discounts and rounding). tax is the sum of printed tax lines (CGST + SGST + IGST, VAT, service tax). If no tax is printed use 0.
            - currency defaults to {companyCurrency} when the receipt shows ₹ or no symbol.
            - Keep line items short; merge obvious continuation lines. Leave quantity, unit_price or amount null when not printed.
            - category must be one of: {categoryList}. Choose the closest; use "other" only when nothing fits.
            - If the image is not a receipt, set is_receipt false and leave the other fields null.
            """;

        try
        {
            var response = await _client.Messages.Create(new MessageCreateParams
            {
                Model = options.ClaudeModel,
                MaxTokens = 2048,
                OutputConfig = new OutputConfig
                {
                    Effort = Effort.Low,
                    Format = new JsonOutputFormat { Schema = schema },
                },
                Messages =
                [
                    new()
                    {
                        Role = Role.User,
                        Content = new List<ContentBlockParam> { attachment, new TextBlockParam { Text = instructions } },
                    },
                ],
            }, ct);

            if (response.StopReason == "refusal")
                return new(null, "refused");

            var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
            if (string.IsNullOrWhiteSpace(text)) return new(null, "empty_response");
            using var doc = JsonDocument.Parse(text);
            return new(doc.RootElement.Clone(), null);
        }
        catch (AnthropicApiException ex)
        {
            log.LogWarning(ex, "Receipt extraction failed ({Status})", ex.StatusCode);
            return new(null, $"api_error:{ex.StatusCode}");
        }
        catch (JsonException ex)
        {
            log.LogWarning(ex, "Receipt extraction returned invalid JSON");
            return new(null, "bad_json");
        }
    }
}
