using System.Data;
using Dapper;
using Npgsql;

namespace SnapClaim.Api.Data;

/// <summary>
/// The single connection entry point. NpgsqlDataSource owns the pool; every
/// endpoint opens a connection per unit of work and disposes it.
/// </summary>
public sealed class Db : IAsyncDisposable
{
    private readonly NpgsqlDataSource _source;

    public Db(SnapClaimOptions options)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;
        DapperHandlers.Register();
        _source = new NpgsqlDataSourceBuilder(options.DbConnection).Build();
    }

    public ValueTask<NpgsqlConnection> Open(CancellationToken ct = default) => _source.OpenConnectionAsync(ct);

    /// <summary>After migrations create extensions or enums, the cached type catalog must be refreshed.</summary>
    public async Task ReloadTypes(CancellationToken ct = default)
    {
        await using var conn = await _source.OpenConnectionAsync(ct);
        await conn.ReloadTypesAsync(ct);
    }

    public ValueTask DisposeAsync() => _source.DisposeAsync();
}

/// <summary>
/// Dapper has no built-in DateOnly support; Npgsql does. This handler bridges
/// the two and stamps the DbType on NULL parameters so PostgreSQL never sees an
/// untyped null in a date comparison.
/// </summary>
public static class DapperHandlers
{
    private static bool _registered;

    public static void Register()
    {
        if (_registered) return;
        _registered = true;
        SqlMapper.AddTypeHandler(typeof(DateOnly), new DateOnlyHandler());
        SqlMapper.AddTypeHandler(typeof(DateOnly?), new DateOnlyHandler());
    }

    private sealed class DateOnlyHandler : SqlMapper.ITypeHandler
    {
        public void SetValue(IDbDataParameter parameter, object? value)
        {
            parameter.DbType = DbType.Date;
            parameter.Value = value is DateOnly d ? d : DBNull.Value;
        }

        public object? Parse(Type destinationType, object value) => value switch
        {
            null or DBNull => null,
            DateOnly d => d,
            DateTime dt => DateOnly.FromDateTime(dt),
            string s => DateOnly.Parse(s),
            _ => throw new InvalidCastException($"Cannot convert {value.GetType()} to DateOnly"),
        };
    }
}
