using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;

namespace RecipeApi.Controllers;

[ApiController]
[Route("recipes")]
public class RecipeController(RecipeDbContext recipeDb) : ControllerBase
{
    private readonly RecipeDbContext _db = recipeDb;

  [HttpGet]
    public async Task<IActionResult> Get()
    {
        var recipes = await _db.Recipes
            .Include(r => r.RecipeIngredients)
                .ThenInclude(i => i.Ingredient)
            .ToListAsync();
        return Ok(recipes);
    }
}