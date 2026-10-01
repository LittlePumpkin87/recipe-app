namespace RecipeApi.Utility;

using Npgsql;

/// <summary>
/// Turns the repository's <c>DATABASE_URL</c> into the connection string Npgsql accepts.
/// Must run before <c>AddDbContext</c> and after <c>DotNetEnv</c> has loaded the
/// root <c>.env</c>.
/// </summary>
public static class UrlExtensions
{
    public static WebApplicationBuilder AddDatabaseConnection(this WebApplicationBuilder builder)
    {
        var defaultUrl = builder.Configuration["ConnectionStrings:Default"];

        if (!string.IsNullOrWhiteSpace(defaultUrl))
        {
            return builder;
        }

        var url = builder.Configuration["DATABASE_URL"];
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new InvalidOperationException(
                "No database connection configured. Set DATABASE_URL in the repository-root .env "
                + "(copy .env.example), or provide ConnectionStrings:Default directly.");

        }

        var uri = new Uri(url);

        var userInfo = uri.UserInfo.Split(':', 2);
        var user = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";

        var host = uri.Host;
        var port = uri.Port == -1 ? 5432 : uri.Port;
        var database = uri.AbsolutePath.TrimStart('/');

        var newUrl = new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Username = user,
            Password = password,
            Database = database
        };

        builder.Configuration["ConnectionStrings:Default"] = newUrl.ToString();
        return builder;
    }
}
