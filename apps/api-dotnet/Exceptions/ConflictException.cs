namespace RecipeApi.Exceptions;

/// <summary>
/// Signals that a write collides with a row that already exists. Named after the status
/// code rather than the table: <c>POST /recipes</c> throws the same type when an
/// ingredient line turns out to be a duplicate. The message ends up as the
/// <c>detail</c> of the response, so it is phrased for a client, not for a log.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
    public ConflictException(string message, Exception innerException) : base(message, innerException) { }
}