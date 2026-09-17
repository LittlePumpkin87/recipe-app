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
/// The second set of attributes faces the other direction. System.Text.Json writes
/// an enum as a <i>number</i> by default, which would put <c>"unit": 6</c> where the
/// NestJS API answers <c>"unit": "TABLESPOON"</c>. <c>JsonStringEnumConverter</c>
/// makes it a string and <c>JsonStringEnumMemberName</c> supplies the spelling. The
/// two families look alike and are read by different libraries — <c>PgName</c> by
/// Npgsql, the JSON ones by the serialiser. That they carry the same text follows
/// from the values chosen, not from any link between them.
/// <c>schema.prisma</c> stays the source of truth: a new unit is added there first,
/// and then needs both attributes here.
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
