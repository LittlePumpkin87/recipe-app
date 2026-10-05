using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;
using RecipeApi.Dtos;
using RecipeApi.Models;
using RecipeApi.Utility;

namespace RecipeApi.Services;

/// <summary>
/// The only place a recipe query may live. Reads project straight into DTOs and answer
/// <c>null</c> rather than throwing; the write path saves twice, so every step of it has
/// to stay inside the transaction <see cref="CreateAsync"/> opens.
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

    /// <summary>
    /// Finds or creates an ingredient per line, keyed by its normalised name. Nothing is
    /// written here — new rows are only queued, and the caller's <c>SaveChangesAsync</c>
    /// decides when they reach the database.
    /// </summary>
    private async Task<Dictionary<string, Ingredient>> ResolveIngredientsAsync(
    IReadOnlyList<CreateRecipeIngredientDto> ingredientLines)
    {
        var normalizedNames = ingredientLines
        .Select(ingredientLine => IngredientName.Normalize(ingredientLine.Name!))
        .Distinct()
        .ToList();

        var ingredientsByName = await _db.Ingredients
        .Where(ingredient => normalizedNames.Contains(ingredient.NameNormalized))
        .ToDictionaryAsync(ingredient => ingredient.NameNormalized);

        foreach (var ingredientLine in ingredientLines)
        {
            var normalizedName = IngredientName.Normalize(ingredientLine.Name!);
            if (ingredientsByName.ContainsKey(normalizedName))
            {
                continue;
            }

            var ingredient = new Ingredient { Name = ingredientLine.Name!, NameNormalized = normalizedName };
            _db.Ingredients.Add(ingredient);
            ingredientsByName.Add(normalizedName, ingredient);

        }
        return ingredientsByName;

    }

    public async Task<RecipeDetailDto> CreateAsync(CreateRecipeDto dto)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync();

        var ingredientsByName = await ResolveIngredientsAsync(dto.Ingredients);
        await _db.SaveChangesAsync();
        var recipe = new Recipe
        {
            Title = dto.Title!,
            Description = dto.Description,
            Instructions = dto.Instructions!,
            PrepMinutes = dto.PrepMinutes,
            TotalMinutes = dto.TotalMinutes,
        };
        if (dto.Servings is int servings)
        {
            recipe.Servings = servings;
        }

        for (var index = 0; index < dto.Ingredients.Count; index++)
        {
            var ingredientLine = dto.Ingredients[index];
            var ingredient = ingredientsByName[IngredientName.Normalize(ingredientLine.Name!)];

            recipe.RecipeIngredients.Add(new RecipeIngredient
            {
                Ingredient = ingredient,
                Note = ingredientLine.Note,
                Amount = ingredientLine.Amount,
                Unit = ingredientLine.Unit,
                GroupLabel = ingredientLine.GroupLabel,
                Position = index + 1,

            });
        }
        _db.Recipes.Add(recipe);
        await _db.SaveChangesAsync();

        await transaction.CommitAsync();

        return (await GetByIdAsync(recipe.Id))!;
    }
}


