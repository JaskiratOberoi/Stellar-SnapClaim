using Dapper;

namespace SnapClaim.Api.Data;

/// <summary>
/// Applies db/sql/*.sql in filename order, once each, recorded in sc_migration.
/// Each script runs inside one transaction, at API start, so a compose deploy
/// is self-contained.
/// </summary>
public sealed class Migrator(Db db, SnapClaimOptions options, ILogger<Migrator> log)
{
    public async Task ApplyAsync(CancellationToken ct)
    {
        if (!Directory.Exists(options.SqlDir))
        {
            log.LogWarning("SQL directory {Dir} not found; skipping migrations", options.SqlDir);
            return;
        }

        await using var conn = await db.Open(ct);
        await conn.ExecuteAsync("CREATE TABLE IF NOT EXISTS sc_migration (script text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
        var applied = (await conn.QueryAsync<string>("SELECT script FROM sc_migration")).ToHashSet(StringComparer.Ordinal);

        var any = false;
        foreach (var file in Directory.GetFiles(options.SqlDir, "*.sql").OrderBy(f => Path.GetFileName(f), StringComparer.Ordinal))
        {
            var name = Path.GetFileName(file);
            if (applied.Contains(name)) continue;
            var sql = await File.ReadAllTextAsync(file, ct);
            log.LogInformation("Applying {Script}", name);
            await using var tx = await conn.BeginTransactionAsync(ct);
            await conn.ExecuteAsync(new CommandDefinition(sql, transaction: tx, cancellationToken: ct));
            await conn.ExecuteAsync("INSERT INTO sc_migration(script) VALUES (@name) ON CONFLICT DO NOTHING", new { name }, tx);
            await tx.CommitAsync(ct);
            any = true;
        }
        if (any) await db.ReloadTypes(ct);
    }

    /// <summary>Dev-only sample company. Applied when SNAPCLAIM_SEED_DEV=true and no company exists.</summary>
    public async Task SeedDevAsync(CancellationToken ct)
    {
        if (!options.SeedDev) return;
        var file = Path.Combine(options.SeedDir, "dev.sql");
        if (!File.Exists(file)) { log.LogWarning("Seed file {File} not found", file); return; }
        await using var conn = await db.Open(ct);
        var companies = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM company");
        if (companies > 0) return;
        log.LogInformation("Seeding dev data from {File}", file);
        await conn.ExecuteAsync(await File.ReadAllTextAsync(file, ct));
    }
}
