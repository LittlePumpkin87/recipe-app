using System;
using System.Collections.Generic;

namespace RecipeApi.Models;

public partial class RecipeIngredient
{
    public Guid Id { get; set; }

    public decimal? Amount { get; set; }

    public Guid IngredientId { get; set; }

    public Guid RecipeId { get; set; }

    public string? Note { get; set; }

    public string? GroupLabel { get; set; }

    public int Position { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Recipe Recipe { get; set; } = null!;
}
