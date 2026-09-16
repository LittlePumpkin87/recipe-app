using System;
using System.Collections.Generic;

namespace RecipeApi.Models;

public partial class Recipe
{
    public Guid Id { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public string Instructions { get; set; } = null!;

    public int Servings { get; set; }

    public int? PrepMinutes { get; set; }

    public string? SourceUrl { get; set; }

    public string? SourceName { get; set; }

    public string? ExternalId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int? TotalMinutes { get; set; }

    public virtual ICollection<RecipeIngredient> RecipeIngredients { get; set; } = new List<RecipeIngredient>();
}
