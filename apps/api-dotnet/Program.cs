// Load DotNetEnv
using Microsoft.EntityFrameworkCore;
using RecipeApi.Data;
using RecipeApi.Models;
using RecipeApi.Utility;
using RecipeApi.Services;
using RecipeApi.Exceptions;

DotNetEnv.Env.NoClobber().TraversePath().Load();


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddDatabaseConnection();

builder.Services.AddDbContext<RecipeDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.MapEnum<Unit>("unit")));


builder.Services.AddControllers();
builder.Services.AddExceptionHandler<ConflictExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddScoped<RecipeService>();


var app = builder.Build();

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

await app.RunAsync();
