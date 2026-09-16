namespace RecipeApi.Data;

using Microsoft.EntityFrameworkCore;
using RecipeApi.Models;

public partial class RecipeDbContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RecipeIngredient>()
            .Property(e => e.Unit)
            .HasColumnName("unit");

        modelBuilder.Entity<Ingredient>()
            .Property(e => e.DefaultUnit)
            .HasColumnName("default_unit");
    }
}
