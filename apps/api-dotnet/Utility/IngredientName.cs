using System.Text;
using System.Text.RegularExpressions;

namespace RecipeApi.Utility;

/// <summary>
/// Produces the value stored in <c>ingredient.name_normalized</c>, the column that
/// carries the unique index. Counterpart to <c>normalize-name.ts</c>
/// </summary>
public static partial class IngredientName
{

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    public static string Normalize(string name)
    {
        var composed = name.Normalize(NormalizationForm.FormC);
        var collapsed = WhitespaceRegex().Replace(composed, " ");
        return collapsed.Trim().ToLowerInvariant();
    }

}