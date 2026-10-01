using Microsoft.AspNetCore.Mvc;
using RecipeApi.Dtos;
using RecipeApi.Services;

namespace RecipeApi.Controllers;

/// <summary>
/// Maps POST /ingredients onto <see cref="IngredientService"/> and holds no business
/// logic.
/// </summary>
[ApiController]
[Route("ingredients")]
public class IngredientController(IngredientService ingredientService) : ControllerBase
{
    private readonly IngredientService _ingredients = ingredientService;

    [HttpPost]
    public async Task<ActionResult<IngredientDto>> Create(CreateIngredientDto dto)
    {
        var ingredient = await _ingredients.CreateAsync(dto);
        return Created((string?)null, ingredient);
    }
}
