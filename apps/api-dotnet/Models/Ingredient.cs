using System;
using System.Collections.Generic;

namespace RecipeApi.Models;

public partial class Ingredient
{
    public Guid Id { get; set; }

    public string? NameEn { get; set; }

    public string NameNormalized { get; set; } = null!;

    public string? NameDe { get; set; }

    public string? NameDePlural { get; set; }

    public string? NameEnPlural { get; set; }

    public virtual ICollection<IngredientAlias> IngredientAliases { get; set; } = new List<IngredientAlias>();

    public virtual ICollection<RecipeIngredient> RecipeIngredients { get; set; } = new List<RecipeIngredient>();
}
