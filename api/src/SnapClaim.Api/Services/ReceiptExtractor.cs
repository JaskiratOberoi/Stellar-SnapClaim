using System.Net.Http.Headers;
using System.Text.Json;

namespace SnapClaim.Api.Services;

/// <summary>
/// Snap &amp; Extract, on the box and for free: the receipt goes to the OCR
/// sidecar (RapidOCR, the ONNX build of PaddleOCR's models), which returns the
/// printed lines; <see cref="ReceiptParser"/> then reads vendor, date, totals,
/// tax, currency, invoice number and a suggested category out of them. No keys,
/// no outside calls. With no OCR URL configured, extraction is skipped and the
/// form is filled by hand.
/// </summary>
public sealed class ReceiptExtractor(SnapClaimOptions options, HttpClient http, ILogger<ReceiptExtractor> log)
{
    public bool Enabled => !string.IsNullOrWhiteSpace(options.OcrUrl);
    public string Model => "rapidocr";

    public static readonly string[] ImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    public static bool Supports(string contentType) => ImageTypes.Contains(contentType) || contentType == "application/pdf";

    public sealed record Result(JsonElement? Extraction, string? Error);

    public sealed record OcrLine(string Text, double Score, double[][] Box);
    private sealed record OcrResponse(int Width, int Height, List<OcrLine> Lines);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    // The stored extraction keeps the snake_case keys the app and the claim form already read.
    private static readonly JsonSerializerOptions Snake = new(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public async Task<Result> Extract(byte[] data, string contentType, IReadOnlyList<(string code, string name)> categories, string companyCurrency, CancellationToken ct)
    {
        if (!Enabled) return new(null, "extraction_disabled");
        if (!Supports(contentType)) return new(null, "unsupported_type");

        OcrResponse? ocr;
        try
        {
            using var content = new ByteArrayContent(data);
            content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            using var res = await http.PostAsync(options.OcrUrl.TrimEnd('/') + "/ocr", content, ct);
            if (!res.IsSuccessStatusCode)
            {
                var detail = await res.Content.ReadAsStringAsync(ct);
                log.LogWarning("OCR service answered {Status}: {Detail}", (int)res.StatusCode, detail);
                return new(null, (int)res.StatusCode == 422 ? "unreadable_file" : $"ocr_error:{(int)res.StatusCode}");
            }
            ocr = await res.Content.ReadFromJsonAsync<OcrResponse>(Json, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning(ex, "OCR service unreachable or returned junk");
            return new(null, "ocr_unavailable");
        }
        if (ocr is null) return new(null, "empty_response");

        var parsed = ReceiptParser.Parse(ocr.Lines, ocr.Height, categories, companyCurrency);
        return new(JsonSerializer.SerializeToElement(parsed, Snake), null);
    }
}
