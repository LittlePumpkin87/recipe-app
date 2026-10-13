namespace RecipeApi.Exceptions;

/// <summary>
/// Signals that a write collides with a row that already exists.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
    public ConflictException(string message, Exception innerException) : base(message, innerException) { }
}