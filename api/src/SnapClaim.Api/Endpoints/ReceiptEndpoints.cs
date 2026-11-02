using System.Security.Cryptography;
using System.Text.Json;
using Dapper;
using Npgsql;
using SnapClaim.Api.Auth;
using SnapClaim.Api.Data;
using SnapClaim.Api.Services;

namespace SnapClaim.Api.Endpoints;

/// <summary>
/// Receipt images. A receipt is uploaded first (snap), extracted, and then
/// attached to a claim by id when the claim is saved.
/// </summary>
public static class ReceiptEndpoints
{
    public sealed record Base64Upload(string Data, string ContentType);

    public sealed class ReceiptRow
    {
        public Guid Id { get; set; }
        public Guid? ClaimId { get; set; }
        public Guid UploadedBy { get; set; }
        public string ContentType { get; set; } = "";
        public int ByteSize { get; set; }
        public string ExtractionStatus { get; set; } = "";
        public string? Extraction { get; set; }
        public string? ExtractionError { get; set; }
        public string? ExtractionModel { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public const string ReceiptSql = "SELECT id, claim_id, uploaded_by, content_type, byte_size, extraction_status::text AS extraction_status, extraction::text AS extraction, extraction_error, extraction_model, created_at FROM receipt";

    public static object Shape(ReceiptRow r) => new
    {
        id = r.Id, claim_id = r.ClaimId, content_type = r.ContentType, byte_size = r.ByteSize,
        extraction_status = r.ExtractionStatus,
        extraction = r.Extraction is null ? (JsonElement?)null : JsonDocument.Parse(r.Extraction).RootElement.Clone(),
        extraction_error = r.ExtractionError, extraction_model = r.ExtractionModel, created_at = r.CreatedAt,
    };

    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/receipts");

        g.MapGet("/capabilities", (ReceiptExtractor extractor) =>
            Results.Ok(new { extraction_enabled = extractor.Enabled, model = extractor.Enabled ? extractor.Model : null, accepted_types = ReceiptExtractor.ImageTypes.Append("application/pdf") }))
            .RequireAuthorization(Policies.User);

        // Multipart: field "file". Web and native FormData both land here.
        g.MapPost("/", async (IFormFile file, HttpContext http, Db db, ReceiptExtractor extractor, SnapClaimOptions opt, CancellationToken ct) =>
        {
            if (file.Length == 0) throw ApiException.Validation("Empty file");
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var contentType = NormaliseType(file.ContentType, file.FileName);
            return Results.Ok(await Store(ms.ToArray(), contentType, http, db, extractor, opt, ct));
        }).DisableAntiforgery().RequireAuthorization(Policies.User);

        // JSON base64 alternative for clients that find multipart awkward.
        g.MapPost("/base64", async (Base64Upload req, HttpContext http, Db db, ReceiptExtractor extractor, SnapClaimOptions opt, CancellationToken ct) =>
        {
            byte[] data;
            try { data = Convert.FromBase64String(req.Data); }
            catch (FormatException) { throw ApiException.Validation("data is not valid base64"); }
            return Results.Ok(await Store(data, NormaliseType(req.ContentType, null), http, db, extractor, opt, ct));
        }).RequireAuthorization(Policies.User);

        g.MapGet("/{id:guid}", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var row = await conn.QuerySingleOrDefaultAsync<ReceiptRow>(ReceiptSql + " WHERE id = @id AND company_id = @companyId", new { id, companyId = me.CompanyId })
                ?? throw ApiException.NotFound("Receipt");
            await RequireCanSee(conn, me, row);
            return Results.Ok(Shape(row));
        }).RequireAuthorization(Policies.User);

        g.MapGet("/{id:guid}/image", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var row = await conn.QuerySingleOrDefaultAsync<ReceiptRow>(ReceiptSql + " WHERE id = @id AND company_id = @companyId", new { id, companyId = me.CompanyId })
                ?? throw ApiException.NotFound("Receipt");
            await RequireCanSee(conn, me, row);
            var data = await conn.ExecuteScalarAsync<byte[]>("SELECT data FROM receipt WHERE id = @id", new { id });
            http.Response.Headers.CacheControl = "private, max-age=86400";
            return Results.File(data!, row.ContentType);
        }).RequireAuthorization(Policies.User);

        // Re-run extraction (key added later, or a transient failure).
        g.MapPost("/{id:guid}/extract", async (Guid id, HttpContext http, Db db, ReceiptExtractor extractor, CancellationToken ct) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var row = await conn.QuerySingleOrDefaultAsync<ReceiptRow>(ReceiptSql + " WHERE id = @id AND company_id = @companyId", new { id, companyId = me.CompanyId })
                ?? throw ApiException.NotFound("Receipt");
            if (row.UploadedBy != me.UserId && !me.IsApprover) throw ApiException.Forbidden();
            var data = await conn.ExecuteScalarAsync<byte[]>("SELECT data FROM receipt WHERE id = @id", new { id });
            await RunExtraction(conn, me.CompanyId, id, data!, row.ContentType, extractor, ct);
            var fresh = await conn.QuerySingleAsync<ReceiptRow>(ReceiptSql + " WHERE id = @id", new { id });
            await Audit.Log(conn, null, http, me, "receipt.extract", "receipt", id, "Re-read a receipt");
            return Results.Ok(Shape(fresh));
        }).RequireAuthorization(Policies.User);

        g.MapDelete("/{id:guid}", async (Guid id, HttpContext http, Db db) =>
        {
            var me = Current.From(http.User);
            await using var conn = await db.Open();
            var n = await conn.ExecuteAsync("""
                DELETE FROM receipt r USING claim c
                WHERE r.id = @id AND r.uploaded_by = @userId AND (r.claim_id IS NULL OR (c.id = r.claim_id AND c.status IN ('draft','rejected')))
                """, new { id, userId = me.UserId });
            if (n == 0)
            {
                // Unattached receipts have no claim row for the USING join; delete those directly.
                n = await conn.ExecuteAsync("DELETE FROM receipt WHERE id = @id AND uploaded_by = @userId AND claim_id IS NULL", new { id, userId = me.UserId });
            }
            if (n == 0) throw ApiException.NotFound("Receipt");
            await Audit.Log(conn, null, http, me, "receipt.delete", "receipt", id, "Removed a receipt");
            return Results.NoContent();
        }).RequireAuthorization(Policies.User);
    }

    private static string NormaliseType(string? contentType, string? fileName)
    {
        var type = (contentType ?? "").Split(';')[0].Trim().ToLowerInvariant();
        if (type is "image/jpg") type = "image/jpeg";
        if (string.IsNullOrEmpty(type) || type == "application/octet-stream")
        {
            var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
            type = ext switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", ".gif" => "image/gif", ".pdf" => "application/pdf", _ => type };
        }
        if (!ReceiptExtractor.Supports(type)) throw ApiException.Validation($"Unsupported file type {type}; use JPEG, PNG, WebP, GIF or PDF");
        return type;
    }

    private static async Task<object> Store(byte[] data, string contentType, HttpContext http, Db db, ReceiptExtractor extractor, SnapClaimOptions opt, CancellationToken ct)
    {
        if (data.Length > opt.MaxReceiptBytes) throw ApiException.Validation($"File is larger than {opt.MaxReceiptBytes / (1024 * 1024)} MB");
        var me = Current.From(http.User);
        await using var conn = await db.Open(ct);
        var id = await conn.ExecuteScalarAsync<Guid>("""
            INSERT INTO receipt(company_id, uploaded_by, content_type, byte_size, sha256, data, extraction_status)
            VALUES (@companyId, @userId, @contentType, @size, @sha, @data, 'pending') RETURNING id
            """, new { companyId = me.CompanyId, userId = me.UserId, contentType, size = data.Length, sha = Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant(), data });
        await RunExtraction(conn, me.CompanyId, id, data, contentType, extractor, ct);
        var row = await conn.QuerySingleAsync<ReceiptRow>(ReceiptSql + " WHERE id = @id", new { id });
        await Audit.Log(conn, null, http, me, "receipt.upload", "receipt", id, $"Uploaded a {contentType} receipt ({Math.Max(1, data.Length / 1024)} KB)", new { size = data.Length, content_type = contentType });
        return Shape(row);
    }

    private static async Task RunExtraction(NpgsqlConnection conn, Guid companyId, Guid id, byte[] data, string contentType, ReceiptExtractor extractor, CancellationToken ct)
    {
        if (!extractor.Enabled)
        {
            await conn.ExecuteAsync("UPDATE receipt SET extraction_status = 'skipped', extraction_error = 'extraction_disabled' WHERE id = @id", new { id });
            return;
        }
        var categories = (await conn.QueryAsync<(string code, string name)>("SELECT code, name FROM category WHERE company_id = @companyId AND is_active ORDER BY sort_order", new { companyId })).ToList();
        var currency = await conn.ExecuteScalarAsync<string>("SELECT currency FROM company WHERE id = @companyId", new { companyId }) ?? "INR";
        var result = await extractor.Extract(data, contentType, categories, currency, ct);
        if (result.Extraction is { } extraction)
            await conn.ExecuteAsync("UPDATE receipt SET extraction_status = 'done', extraction = @json::jsonb, extraction_error = NULL, extraction_model = @model WHERE id = @id",
                new { id, json = extraction.GetRawText(), model = extractor.Model });
        else
            await conn.ExecuteAsync("UPDATE receipt SET extraction_status = 'failed', extraction_error = @error, extraction_model = @model WHERE id = @id",
                new { id, error = result.Error, model = extractor.Model });
    }

    public static async Task RequireCanSee(NpgsqlConnection conn, Current me, ReceiptRow row)
    {
        if (row.UploadedBy == me.UserId || me.SeesAllClaims) return;
        if (row.ClaimId is null) throw ApiException.Forbidden();
        if (!me.IsApprover) throw ApiException.Forbidden();
        var ok = await conn.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM claim c JOIN app_user e ON e.id = c.employee_id WHERE c.id = @claimId AND e.manager_id = @userId)",
            new { claimId = row.ClaimId, userId = me.UserId });
        if (!ok) throw ApiException.Forbidden();
    }
}
