namespace RecipeApi.Data;

using Microsoft.EntityFrameworkCore;
using RecipeApi.Models;

public partial class RecipeDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RecipeIngredient>()
            .Property(recipeIngredient => recipeIngredient.Unit)
            .HasColumnName("unit");

        modelBuilder.Entity<Ingredient>()
            .Property(ingredient => ingredient.DefaultUnit)
            .HasColumnName("default_unit");

        modelBuilder.Entity<Ingredient>()
            .Property(ingredient => ingredient.Language)
            .HasColumnName("language");

        modelBuilder.Entity<IngredientAlias>()
            .Property(ingredientAlias => ingredientAlias.Language)
            .HasColumnName("language");

        modelBuilder.Entity<Recipe>()
            .Property(language => language.Language)
            .HasColumnName("language");
    }
}
