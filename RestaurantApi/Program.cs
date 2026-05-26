using Microsoft.EntityFrameworkCore;
using RestaurantApi.Data;
using RestaurantApi.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();

// ── Database: SQLite (bền vững khi restart) ──────────────────────────
var dbPath = Path.Combine(builder.Environment.ContentRootPath, "restaurant.db");
builder.Services.AddDbContext<RestaurantDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// ── SignalR ───────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── CORS: cho phép Frontend (localhost dev + Vercel production) ───────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true)
              .AllowCredentials();
    });
});

var app = builder.Build();

// ── Tự động tạo/migrate DB khi khởi động ─────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
    db.Database.Migrate();
}

app.UseCors("AllowAll");

// ── SignalR Hub ───────────────────────────────────────────────────────
app.MapHub<OrderHub>("/orderHub");

// ── Minimal APIs ──────────────────────────────────────────────────────
app.MapGet("/api/tables", async (RestaurantDbContext db) =>
    await db.Tables.ToListAsync());

app.MapGet("/api/menu", async (RestaurantDbContext db) =>
    await db.MenuItems.ToListAsync());

// ── Chạy với PORT từ môi trường (Railway cung cấp) ───────────────────
var port = Environment.GetEnvironmentVariable("PORT") ?? "5296";
app.Run($"http://0.0.0.0:{port}");
