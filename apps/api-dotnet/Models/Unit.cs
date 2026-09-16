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
public enum Unit
{
    [PgName("GRAM")] Gram,
    [PgName("KILOGRAM")] Kilogram,
    [PgName("MILLILITER")] Milliliter,
    [PgName("LITER")] Liter,
    [PgName("PIECE")] Piece,
    [PgName("CUP")] Cup,
    [PgName("TABLESPOON")] Tablespoon,
    [PgName("TEASPOON")] Teaspoon,
    [PgName("PINCH")] Pinch,
    [PgName("BUNCH")] Bunch,
    [PgName("CLOVE")] Clove,
    [PgName("SLICE")] Slice,
    [PgName("PACK")] Pack,
    [PgName("CAN")] Can,
}
