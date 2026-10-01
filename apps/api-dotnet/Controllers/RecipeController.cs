using Microsoft.AspNetCore.Mvc;
using RecipeApi.Dtos;
using RecipeApi.Services;

namespace RecipeApi.Controllers;

/// <summary>
/// Maps the /recipes endpoints onto <see cref="RecipeService"/> and holds no business
/// logic.
/// </summary>
[ApiController]
[Route("recipes")]
public class RecipeController(RecipeService recipeService) : ControllerBase
{
    private readonly RecipeService _recipes = recipeService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecipeListItemDto>>> GetAll(
          [FromQuery] string? search
      )
    {
        return Ok(await _recipes.GetAllAsync(search));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RecipeDetailDto>> GetById(Guid id)
    {
        var recipe = await _recipes.GetByIdAsync(id);
        return recipe is null ? NotFound() : Ok(recipe);
    }
}