using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Utility;

/// <summary>
/// Rejects a decimal carrying more decimal places than allowed. Without it
/// <c>numeric(8,2)</c> would silently round the surplus away on insert.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class MaxDecimalPlacesAttribute(int maxDecimalPlaces) : ValidationAttribute
{
    private readonly int _maxDecimalPlaces = maxDecimalPlaces;

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null)
        {
            return ValidationResult.Success;
        }
        if (value is not decimal amount)
        {
            return new ValidationResult(
                $"{validationContext.DisplayName} must be a decimal number.",
                [validationContext.MemberName!]
            );
        }
        if (Math.Round(amount, _maxDecimalPlaces) != amount)
        {
            return new ValidationResult(
                $"{validationContext.DisplayName} must have at most {_maxDecimalPlaces} decimal places.",
                [validationContext.MemberName!]);
        }

        return ValidationResult.Success;
    }

}