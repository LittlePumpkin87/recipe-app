using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace RecipeApi.Models;
/// <summary>
/// The C# side of the Postgres enum <c>unit</c>. <c>PgName</c> is read by Npgsql, the
/// Json attributes by the serialiser; a new unit goes into <c>schema.prisma</c> first
/// and then needs both here.
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
