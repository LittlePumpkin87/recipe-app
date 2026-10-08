using System.ComponentModel.DataAnnotations;
using RecipeApi.Models;
using RecipeApi.Utility;

namespace RecipeApi.Dtos;

public record RecipeListItemDto(
    Guid Id,
    string Title,
    int Servings,
    int? PrepMinutes,
    int? TotalMinutes
);

public record RecipeDetailDto(
    Guid Id,
    string Title,
    int Servings,
    int? PrepMinutes,
    int? TotalMinutes,
    string? Description,
    string Instructions,
    IReadOnlyList<RecipeIngredientDto> Ingredients

);

public record RecipeIngredientDto(
    Guid IngredientId,
    string Name,
    decimal? Amount,
    Unit? Unit,
    string? Note,
    string? GroupLabel,
    int Position
);

public class CreateRecipeIngredientDto
{
    private string? _name;

    [Required]
    [MaxLength(120)]
    public string? Name
    {
        get => _name;
        set => _name = value?.Trim();
    }

    [MaxLength(80)]
    public string? Note { get; set; }

    public Unit? Unit { get; set; }

    [Range(0.01, 9999)]
    [MaxDecimalPlaces(2)]
    public decimal? Amount { get; set; }

    [MaxLength(100)]
    public string? GroupLabel { get; set; }
}

public class CreateRecipeDto : IValidatableObject
{
    private string? _title;
    private string? _instructions;

    [Required]
    [MaxLength(100)]
    public string? Title
    {
        get => _title;
        set => _title = value?.Trim();
    }

    [Required]
    public string? Instructions
    {
        get => _instructions;
        set => _instructions = value?.Trim();
    }

    [Range(1, int.MaxValue)]
    public int? TotalMinutes { get; set; }

    [Range(1, int.MaxValue)]
    public int? PrepMinutes { get; set; }

    public string? Description { get; set; }

    [Required]
    [MinLength(1)]
    public List<CreateRecipeIngredientDto> Ingredients { get; set; } = [];

    private int? _servings;
    private bool _servingsGiven;

    [Range(1, int.MaxValue)]
    public int? Servings
    {
        get => _servings;
        set
        {
            _servings = value;
            _servingsGiven = true;
        }
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (_servingsGiven && _servings is null)
        {
            yield return new ValidationResult(
                "The field Servings may be omitted, but it must not be null.",
                [nameof(Servings)]);
        }
    }
}

public class UpdateRecipeDto : IValidatableObject
{
    private string? _title;
    private bool _titleGiven;

    [MaxLength(100)]
    [MinLength(1)]
    public string? Title
    {
        get => _title;
        set
        {
            _title = value?.Trim();
            _titleGiven = true;
        }
    }
    private string? _description;

    public string? Description
    {
        get => _description;
        set
        {
            _description = value;
            DescriptionGiven = true;
        }
    }

    public bool DescriptionGiven { get; private set; }

    private int? _prepMinutes;

    [Range(1, int.MaxValue)]
    public int? PrepMinutes
    {
        get => _prepMinutes;
        set
        {
            _prepMinutes = value;
            PrepMinutesGiven = true;
        }

    }
    public bool PrepMinutesGiven { get; private set; }

    private int? _totalMinutes;

    [Range(1, int.MaxValue)]
    public int? TotalMinutes
    {
        get => _totalMinutes;
        set
        {
            _totalMinutes = value;
            TotalMinutesGiven = true;
        }

    }

    public bool TotalMinutesGiven { get; private set; }

    private string? _instructions;
    private bool _instructionsGiven;

    [MinLength(1)]
    public string? Instructions
    {
        get => _instructions;
        set
        {
            _instructions = value;
            _instructionsGiven = true;
        }
    }

    private int? _servings;
    private bool _servingsGiven;
    
    [Range(1, int.MaxValue)]
    public int? Servings
    {
        get => _servings;
        set
        {
            _servings = value;
            _servingsGiven = true;
        }
    }

    private List<CreateRecipeIngredientDto>? _ingredients;
    private bool _ingredientsGiven;

    [MinLength(1)]
    public List<CreateRecipeIngredientDto>? Ingredients
    {
        get => _ingredients;
        set
        {
            _ingredients = value;
            _ingredientsGiven = true;
        }
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (_titleGiven && _title is null)
        {
            yield return new ValidationResult(
                "The field Title may be omitted, but it must not be null.",
                [nameof(Title)]);
        }

        if (_ingredientsGiven && _ingredients is null)
        {
            yield return new ValidationResult(
                "The field Ingredients may be omitted, but it must not be null.",
                [nameof(Ingredients)]);
        }

        if (_instructionsGiven && _instructions is null)
        {
            yield return new ValidationResult(
                "The field Instructions may be omitted, but it must not be null.",
            [nameof(Instructions)]);
        }

        if (_servingsGiven && _servings is null)
        {
            yield return new ValidationResult(
                "The field Servings may be omitted, but it must not be null.",
                [nameof(Servings)]
);
        }
    }
}