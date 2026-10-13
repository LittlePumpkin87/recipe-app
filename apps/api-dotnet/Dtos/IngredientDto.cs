using System.ComponentModel.DataAnnotations;
using RecipeApi.Models;

namespace RecipeApi.Dtos;

/// <summary>
/// What the ingredient endpoints return.
/// </summary>
public record IngredientDto
(Guid Id,
    string Name,
    Unit? DefaultUnit
);


/// <summary>
/// The body of <c>POST /ingredients</c>.
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