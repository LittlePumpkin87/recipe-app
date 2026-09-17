using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;
using RecipeApi.Dtos;
using RecipeApi.Models;

namespace RecipeApi.Services;

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
