using System;
using System.Collections.Generic;

namespace RecipeApi.Models;

public partial class IngredientAlias
{
    public Guid Id { get; set; }

    public string Alias { get; set; } = null!;

    public Guid IngredientId { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;
}
