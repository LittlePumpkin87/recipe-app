using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace RecipeApi.Models;
/// <summary>
/// The C# side of the Postgres enum <c>language</c>. <c>PgName</c> is read by Npgsql, the
/// Json attributes by the serialiser; a new unit goes into <c>schema.prisma</c> first
/// and then needs both here.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Language
{
    [PgName("DE")][JsonStringEnumMemberName("DE")] De,
    [PgName("EN")][JsonStringEnumMemberName("EN")] En,
}