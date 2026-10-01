namespace RecipeApi.Exceptions;

/// <summary>
/// Signals that a write collides with a row that already exists. Shared by every writing
/// endpoint, and its message is phrased for a client: it becomes the response's detail.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
    public ConflictException(string message, Exception innerException) : base(message, innerException) { }
}