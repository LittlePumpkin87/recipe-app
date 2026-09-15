// Load DotNetEnv
using RecipeApi.Utility;
DotNetEnv.Env.NoClobber().TraversePath().Load();


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddDatabaseConnection();
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();

await app.RunAsync();
