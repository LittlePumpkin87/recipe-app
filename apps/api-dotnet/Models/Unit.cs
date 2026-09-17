using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace RecipeApi.Models;
/// <summary>
/// The C# side of the Postgres enum <c>unit</c>; EF Core has no CLR type for it and
/// scaffolding skips it. Two attribute families with different readers: <c>PgName</c>
/// by Npgsql, whose snake_case default would look for <c>gram</c> instead of
/// <c>GRAM</c>, and the Json ones by the serialiser, which would otherwise write
/// <c>"unit": 6</c> where NestJS answers <c>"unit": "TABLESPOON"</c>.
/// <c>schema.prisma</c> stays the source of truth: a new unit goes there first and
/// then needs both attributes here.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Unit
{
    [PgName("GRAM")][JsonStringEnumMemberName("GRAM")] Gram,
    [PgName("KILOGRAM")][JsonStringEnumMemberName("KILOGRAM")] Kilogram,
    [PgName("MILLILITER")][JsonStringEnumMemberName("MILLILITER")] Milliliter,
    [PgName("LITER")][JsonStringEnumMemberName("LITER")] Liter,
    [PgName("PIECE")][JsonStringEnumMemberName("PIECE")] Piece,
    [PgName("CUP")][JsonStringEnumMemberName("CUP")] Cup,
    [PgName("TABLESPOON")][JsonStringEnumMemberName("TABLESPOON")] Tablespoon,
    [PgName("TEASPOON")][JsonStringEnumMemberName("TEASPOON")] Teaspoon,
    [PgName("PINCH")][JsonStringEnumMemberName("PINCH")] Pinch,
    [PgName("BUNCH")][JsonStringEnumMemberName("BUNCH")] Bunch,
    [PgName("CLOVE")][JsonStringEnumMemberName("CLOVE")] Clove,
    [PgName("SLICE")][JsonStringEnumMemberName("SLICE")] Slice,
    [PgName("PACK")][JsonStringEnumMemberName("PACK")] Pack,
    [PgName("CAN")][JsonStringEnumMemberName("CAN")] Can,
}
