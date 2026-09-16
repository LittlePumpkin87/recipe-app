namespace RecipeApi.Models;

public partial class Ingredient
{
    public Unit? DefaultUnit { get; set; }
}

public partial class RecipeIngredient
{
    public Unit? Unit { get; set; }

}
