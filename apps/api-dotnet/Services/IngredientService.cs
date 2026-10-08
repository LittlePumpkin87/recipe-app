using Microsoft.EntityFrameworkCore;
using Npgsql;
using RecipeApi.Data;
using RecipeApi.Dtos;
using RecipeApi.Exceptions;
using RecipeApi.Models;
using RecipeApi.Utility;

namespace RecipeApi.Services;

/// <summary>
/// The only place an ingredient query may live. No entity leaves this class — what the
/// endpoints return is built here.
/// </summary>
public class IngredientService(RecipeDbContext recipeDb)
{
    private readonly RecipeDbContext _db = recipeDb;


    public async Task<IReadOnlyList<IngredientDto>> GetAllAsync(string? search)
    {
        var normalizedSearch = IngredientName.Normalize(search ?? string.Empty);
        IQueryable<Ingredient> query = _db.Ingredients;
        if (!string.IsNullOrEmpty(normalizedSearch))
        {
            query = query.Where(ingredient =>
                EF.Functions.Like(ingredient.NameNormalized, $"%{normalizedSearch}%"));
        }
        return await query
        .OrderBy(ingredient => ingredient.Name)
        .Take(20)
        .Select(ingredient => new IngredientDto(
            ingredient.Id,
            ingredient.Name,
            ingredient.DefaultUnit
        )).ToListAsync();
    }


    public async Task<IngredientDto> CreateAsync(CreateIngredientDto dto)
    {
        ArgumentNullException.ThrowIfNull(dto.Name);

        var ingredient = new Ingredient
        {
            Name = dto.Name,
            NameNormalized = IngredientName.Normalize(dto.Name),
            DefaultUnit = dto.DefaultUnit,

        };

        _db.Ingredients.Add(ingredient);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new ConflictException($"An ingredient with the name \"{dto.Name}\" already exists", exception);
        }

        return new IngredientDto(ingredient.Id, ingredient.Name, ingredient.DefaultUnit);
    }
}
