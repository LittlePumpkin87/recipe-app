using RecipeApi.Models;

namespace RecipeApi.Dtos;

public record RecipeListItemDto(
    Guid Id,
    string Title,
    int Servings,
    int? PrepMinutes,
    int? TotalMinutes
);

public record RecipeDetailDto(
    Guid Id,
    string Title,
    int Servings,
    int? PrepMinutes,
    int? TotalMinutes,
    string? Description,
    string Instructions,
    IReadOnlyList<RecipeIngredientDto> Ingredients

);

public record RecipeIngredientDto(
    Guid IngredientId,
    string Name,
    decimal? Amount,
    Unit? Unit,
    string? Note,
    string? GroupLabel,
    int Position
);

