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
        var searchTerm = search?.Trim();
        IQueryable<Recipe> query = _db.Recipes;
        if (!string.IsNullOrEmpty(searchTerm))
        {
            query = query.Where(recipe => EF.Functions.ILike(recipe.Title, $"%{searchTerm}%"));
        }
        return await query
            .OrderBy(recipe => recipe.Title)
            .Select(recipe => new RecipeListItemDto(
                recipe.Id,
                recipe.Title,
                recipe.Servings,
                recipe.PrepMinutes,
                recipe.TotalMinutes
            )).ToListAsync();
    }


    public async Task<RecipeDetailDto?> GetByIdAsync(Guid id)
    {
        return await _db.Recipes
            .Where(recipe => recipe.Id == id)
            .Select(recipe => new RecipeDetailDto(
                recipe.Id,
                recipe.Title,
                recipe.Servings,
                recipe.PrepMinutes,
                recipe.TotalMinutes,
                recipe.Description,
                recipe.Instructions,
                recipe.RecipeIngredients
                        .OrderBy(recipeIngredient => recipeIngredient.Position)
                        .Select(recipeIngredient => new RecipeIngredientDto(
                            recipeIngredient.IngredientId,
                            recipeIngredient.Ingredient.Name,
                            recipeIngredient.Amount,
                            recipeIngredient.Unit,
                            recipeIngredient.Note,
                            recipeIngredient.GroupLabel,
                            recipeIngredient.Position))
                    .ToList()))
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Finds or creates an ingredient per line, keyed by its normalised name. Nothing is
    /// written here — new rows are only queued, and the caller's <c>SaveChangesAsync</c>
    /// decides when they reach the database.
    /// <para>Three things are called "ingredient" around here and each has its own word:
    /// an <c>ingredientLine</c> is what the request sent, an <c>ingredient</c> is the row
    /// in the table, and a <c>recipeIngredient</c> is the link between a recipe and
    /// one of them.</para>
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

    public async Task<bool> DeleteAsync(Guid id)
    {
        var deleted = await _db.Recipes
        .Where(recipe => recipe.Id == id)
        .ExecuteDeleteAsync();

        return deleted == 1;
    }

    public async Task<RecipeDetailDto?> UpdateAsync(Guid id, UpdateRecipeDto dto)
    {
        var recipe = await _db.Recipes
        .FirstOrDefaultAsync(recipe => recipe.Id == id);
        if (recipe is null)
        {
            return null;
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();

        if (dto.Title is not null)
        {
            recipe.Title = dto.Title;
        }

        if (dto.DescriptionGiven)
        {
            recipe.Description = dto.Description;
        }

        if (dto.Instructions is not null)
        {
            recipe.Instructions = dto.Instructions;
        }

        if (dto.PrepMinutesGiven)
        {
            recipe.Description = dto.Description;
        }

        if (dto.PrepMinutesGiven)
        {
            recipe.PrepMinutes = dto.PrepMinutes;
        }

        if (dto.Servings is not null)
        {
            recipe.Servings = (int)dto.Servings;
        }

        recipe.UpdatedAt = DateTime.UtcNow;

        if (dto.Ingredients is not null)
        {
            var ingredientsByName = await ResolveIngredientsAsync(dto.Ingredients);
            await _db.SaveChangesAsync();

            await _db.RecipeIngredients
            .Where(recipeIngredient => recipeIngredient.RecipeId == id)
            .ExecuteDeleteAsync();

            for (var index = 0; index < dto.Ingredients.Count; index++)
            {
                var ingredientLine = dto.Ingredients[index];
                _db.RecipeIngredients.Add(new RecipeIngredient
                {
                    RecipeId = id,
                    IngredientId = ingredientsByName[IngredientName.Normalize(ingredientLine.Name!)].Id,
                    Position = index + 1
                });
            }
        }

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        return await GetByIdAsync(id);
    }
}

