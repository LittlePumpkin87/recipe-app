using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace RecipeApi.Models;
/// <summary>
/// The C# side of the Postgres enum <c>language</c>.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Language
{
    [PgName("DE")][JsonStringEnumMemberName("DE")] De,
    [PgName("EN")][JsonStringEnumMemberName("EN")] En,
}