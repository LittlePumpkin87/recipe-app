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
/// The body of <c>POST /ingredients</c>. <c>Name</c> is trimmed in the setter, before
/// validation sees it.
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