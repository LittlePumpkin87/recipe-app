using Microsoft.AspNetCore.Mvc;
using RecipeApi.Dtos;
using RecipeApi.Services;

namespace RecipeApi.Controllers;

[ApiController]
[Route("recipes")]
/// <summary>
/// Maps the /recipes HTTP endpoints onto <see cref="RecipeService"/>. Holds no
/// business logic: what a recipe is and where it comes from is the service's
/// concern, so a change of data source never reaches this file.
/// The id parameter carries no <c>:guid</c> route constraint on purpose. Without
/// it the route still matches, model binding fails on a path that is not a UUID,
/// and <c>[ApiController]</c> answers 400 — with the constraint the route would
/// miss entirely and answer 404, which the contract reserves for a valid id that
/// belongs to no recipe.
/// </summary>
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