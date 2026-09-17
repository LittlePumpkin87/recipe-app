using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace RecipeApi.Models;
/// <summary>
/// The C# side of the Postgres enum <c>unit</c>. Scaffolding cannot produce it:
/// EF Core has no CLR type to map the column to and skips it with a warning, which
/// is why <c>ingredient.default_unit</c> and <c>recipe_ingredient.unit</c> arrive
/// as hand-written properties.
/// The <c>PgName</c> attributes are not decoration. Npgsql translates member names
/// to snake_case by default, which would look for <c>gram</c> and find nothing —
/// the values in Postgres are upper case. Every value is therefore spelled out.
/// <c>schema.prisma</c> stays the source of truth: a new unit is added there first.
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
