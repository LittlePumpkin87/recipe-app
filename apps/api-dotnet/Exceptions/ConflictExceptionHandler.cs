using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace RecipeApi.Exceptions;

/// <summary>
/// Turns <see cref="ConflictException"/> into a 409 with a <c>ProblemDetails</c> body
/// and hands every other exception on.
/// </summary>
public class ConflictExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetails = problemDetails;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not ConflictException)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;

        return await _problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Resource already exists",
                Detail = exception.Message,
            },
        });
    }
}
