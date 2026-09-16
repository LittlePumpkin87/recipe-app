using System;
using System.Collections.Generic;

namespace RecipeApi.Models;

public partial class Ingredient
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string NameNormalized { get; set; } = null!;

    public virtual ICollection<IngredientAlias> IngredientAliases { get; set; } = new List<IngredientAlias>();

    public virtual ICollection<RecipeIngredient> RecipeIngredients { get; set; } = new List<RecipeIngredient>();
}
