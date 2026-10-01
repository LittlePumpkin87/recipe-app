using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace RecipeApi.Exceptions;

/// <summary>
/// Turns <see cref="ConflictException"/> into 409. NestJS maps any <c>HttpException</c>
/// to a response through a filter it ships with; ASP.NET Core has no such mapping, so
/// without a handler the exception would end as 500. Every registered handler is offered
/// every exception — the type check below, not the framework, decides what belongs here,
/// and <c>false</c> hands the rest on. The body goes through <c>IProblemDetailsService</c>
/// so that a 409 looks like the 400 from validation.
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
