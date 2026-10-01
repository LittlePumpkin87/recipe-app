// Load DotNetEnv
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;
using RecipeApi.Exceptions;
using RecipeApi.Models;
using RecipeApi.Services;
using RecipeApi.Utility;

DotNetEnv.Env.NoClobber().TraversePath().Load();


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddDatabaseConnection();

builder.Services.AddDbContext<RecipeDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.MapEnum<Unit>("unit")));


builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});
builder.Services.AddExceptionHandler<ConflictExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddScoped<RecipeService>();
builder.Services.AddScoped<IngredientService>();

var app = builder.Build();

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

await app.RunAsync();
