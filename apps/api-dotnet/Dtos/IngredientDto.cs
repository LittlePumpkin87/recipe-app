using System.ComponentModel.DataAnnotations;
using RecipeApi.Models;

namespace RecipeApi.Dtos;

/// <summary>
/// What the ingredient endpoints return. <c>NameNormalized</c> is left out on purpose:
/// it exists for the unique index and the search and means nothing to a client.
/// </summary>
public record IngredientDto
(Guid Id,
    string Name,
    Unit? DefaultUnit
);


/// <summary>
/// A class, not a record: validation attributes on a positional parameter never reach
/// the property, and the trimming needs a setter. It runs before validation, which is
/// what stops <c>"   "</c> from passing <c>[Required]</c> and normalizing to an empty
/// <c>name_normalized</c> — the counterpart to Nest's <c>@Transform</c>.
/// </summary>
public class CreateIngredientDto
{
    private string? _name;

    [Required]
    [MaxLength(120)]
    public string? Name
    {
        get => _name;
        set => _name = value?.Trim();
    }

    public Unit? DefaultUnit { get; set; }
}