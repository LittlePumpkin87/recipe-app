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
}