using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;
using RecipeApi.Dtos;
using RecipeApi.Models;

namespace RecipeApi.Services;

/// <summary>
/// Business logic for recipes, and the only place a database query for them may
/// live. Both read paths project straight into DTOs instead of loading entities:
/// in EF Core the projection <i>is</i> the column list, so the overview never
/// reads <c>instructions</c>, the detail query reaches the ingredient name
/// through the navigation rather than through <c>Include</c>, and no entity ever
/// leaves this class. A recipe that does not exist is reported as <c>null</c>
/// rather than as an exception — ASP.NET Core ships no filter that would turn one
/// into a 404, so the controller decides what the absence means.
/// </summary>
public class RecipeService(RecipeDbContext recipeDb)
{
    private readonly RecipeDbContext _db = recipeDb;

    public async Task<IReadOnlyList<RecipeListItemDto>> GetAllAsync(string? search)
    {
        var term = search?.Trim();
        IQueryable<Recipe> query = _db.Recipes;
        if (!string.IsNullOrEmpty(term))
        {
            query = query.Where(r => EF.Functions.ILike(r.Title, $"%{term}%"));
        }
        return await query
            .OrderBy(r => r.Title)
            .Select(r => new RecipeListItemDto(
                r.Id,
                r.Title,
                r.Servings,
                r.PrepMinutes,
                r.TotalMinutes
            )).ToListAsync();
    }


    public async Task<RecipeDetailDto?> GetByIdAsync(Guid id)
    {
        return await _db.Recipes
            .Where(r => r.Id == id)
            .Select(r => new RecipeDetailDto(
                r.Id,
                r.Title,
                r.Servings,
                r.PrepMinutes,
                r.TotalMinutes,
                r.Description,
                r.Instructions,
                r.RecipeIngredients
                        .OrderBy(i => i.Position)
                        .Select(i => new RecipeIngredientDto(
                         i.IngredientId,
                        i.Ingredient.Name,
                        i.Amount,
                        i.Unit,
                        i.Note,
                        i.GroupLabel,
                        i.Position))
                    .ToList()))
            .FirstOrDefaultAsync();
    }
}
