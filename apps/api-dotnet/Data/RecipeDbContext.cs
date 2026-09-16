using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Models;

namespace RecipeApi.Data;

public partial class RecipeDbContext : DbContext
{
    public RecipeDbContext(DbContextOptions<RecipeDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Ingredient> Ingredients { get; set; }

    public virtual DbSet<IngredientAlias> IngredientAliases { get; set; }

    public virtual DbSet<Recipe> Recipes { get; set; }

    public virtual DbSet<RecipeIngredient> RecipeIngredients { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum("unit", new[] { "GRAM", "KILOGRAM", "MILLILITER", "LITER", "PIECE", "CUP", "TABLESPOON", "TEASPOON", "PINCH", "BUNCH", "CLOVE", "SLICE", "PACK", "CAN" });

        modelBuilder.Entity<Ingredient>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("ingredient_pkey");

            entity.ToTable("ingredient");

            entity.HasIndex(e => e.NameNormalized, "ingredient_name_normalized_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuidv7()")
                .HasColumnName("id");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.NameNormalized)
                .HasMaxLength(120)
                .HasColumnName("name_normalized");
        });

        modelBuilder.Entity<IngredientAlias>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("ingredient_alias_pkey");

            entity.ToTable("ingredient_alias");

            entity.HasIndex(e => e.Alias, "ingredient_alias_alias_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuidv7()")
                .HasColumnName("id");
            entity.Property(e => e.Alias)
                .HasMaxLength(120)
                .HasColumnName("alias");
            entity.Property(e => e.IngredientId).HasColumnName("ingredient_id");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.IngredientAliases)
                .HasForeignKey(d => d.IngredientId)
                .HasConstraintName("ingredient_alias_ingredient_id_fkey");
        });

        modelBuilder.Entity<Recipe>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("recipe_pkey");

            entity.ToTable("recipe");

            entity.HasIndex(e => new { e.SourceName, e.ExternalId }, "recipe_source_name_external_id_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuidv7()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.ExternalId)
                .HasMaxLength(100)
                .HasColumnName("external_id");
            entity.Property(e => e.Instructions).HasColumnName("instructions");
            entity.Property(e => e.PrepMinutes).HasColumnName("prep_minutes");
            entity.Property(e => e.Servings)
                .HasDefaultValue(2)
                .HasColumnName("servings");
            entity.Property(e => e.SourceName)
                .HasMaxLength(150)
                .HasColumnName("source_name");
            entity.Property(e => e.SourceUrl).HasColumnName("source_url");
            entity.Property(e => e.Title)
                .HasMaxLength(100)
                .HasColumnName("title");
            entity.Property(e => e.TotalMinutes).HasColumnName("total_minutes");
            entity.Property(e => e.UpdatedAt)
                .HasPrecision(3)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<RecipeIngredient>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("recipe_ingredient_pkey");

            entity.ToTable("recipe_ingredient");

            entity.HasIndex(e => e.IngredientId, "recipe_ingredient_ingredient_id_idx");

            entity.HasIndex(e => e.RecipeId, "recipe_ingredient_recipe_id_idx");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("uuidv7()")
                .HasColumnName("id");
            entity.Property(e => e.Amount)
                .HasPrecision(8, 2)
                .HasColumnName("amount");
            entity.Property(e => e.GroupLabel)
                .HasMaxLength(100)
                .HasColumnName("group_label");
            entity.Property(e => e.IngredientId).HasColumnName("ingredient_id");
            entity.Property(e => e.Note)
                .HasMaxLength(80)
                .HasColumnName("note");
            entity.Property(e => e.Position).HasColumnName("position");
            entity.Property(e => e.RecipeId).HasColumnName("recipe_id");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.RecipeIngredients)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("recipe_ingredient_ingredient_id_fkey");

            entity.HasOne(d => d.Recipe).WithMany(p => p.RecipeIngredients)
                .HasForeignKey(d => d.RecipeId)
                .HasConstraintName("recipe_ingredient_recipe_id_fkey");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
