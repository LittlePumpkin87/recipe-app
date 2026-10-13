using Microsoft.AspNetCore.Mvc;
using RecipeApi.Dtos;
using RecipeApi.Services;

namespace RecipeApi.Controllers;

/// <summary>
/// Maps the /ingredients endpoints onto <see cref="IngredientService"/>.
/// </summary>
[ApiController]
[Route("ingredients")]
public class IngredientController(IngredientService ingredientService) : ControllerBase
{
    private readonly IngredientService _ingredients = ingredientService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<IngredientDto>>> GetAll(
        [FromQuery] string? search
    )
    {
        return Ok(await _ingredients.GetAllAsync(search));
    }

    [HttpPost]
    public async Task<ActionResult<IngredientDto>> Create(CreateIngredientDto dto)
    {
        var ingredient = await _ingredients.CreateAsync(dto);
        return Created((string?)null, ingredient);
    }
}
