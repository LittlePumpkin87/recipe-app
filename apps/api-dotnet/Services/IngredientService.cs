using Microsoft.EntityFrameworkCore;
using Npgsql;
using RecipeApi.Data;
using RecipeApi.Dtos;
using RecipeApi.Exceptions;
using RecipeApi.Models;
using RecipeApi.Utility;

namespace RecipeApi.Services;

/// <summary>
/// Business logic and database queries for the central ingredient list.
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
        .OrderBy(ingredient => ingredient.NameNormalized)
        .Take(20)
        .Select(ingredient => new IngredientDto(
            ingredient.Id,
            ingredient.NameDe,
            ingredient.NameEn,
            ingredient.NameDePlural,
            ingredient.NameEnPlural,
            ingredient.DefaultUnit
        )).ToListAsync();
    }


    public async Task<IngredientDto> CreateAsync(CreateIngredientDto dto)
    {
        ArgumentNullException.ThrowIfNull(dto.Name);
        var normalizedName = IngredientName.Normalize(dto.Name);
        var language = dto.Language!.Value;

        var ingredient = new Ingredient
        {
            NameDe = dto.Language == Language.De ? dto.Name : null,
            NameEn = dto.Language == Language.En ? dto.Name : null,
            NameNormalized = IngredientName.Normalize(dto.Name),
            Language = language,
            DefaultUnit = dto.DefaultUnit,

        };
        ingredient.IngredientAliases.Add(new IngredientAlias
        {
            Alias = normalizedName,
            Language = language,
        });

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

        return new IngredientDto(
            ingredient.Id,
            ingredient.NameDe,
            ingredient.NameEn,
            ingredient.NameDePlural,
            ingredient.NameEnPlural,
            ingredient.DefaultUnit);
    }
}
