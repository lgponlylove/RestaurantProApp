using Microsoft.EntityFrameworkCore;
using RestaurantApi.Data;
using RestaurantApi.Hubs;
using RestaurantApi.Models;
using Microsoft.AspNetCore.SignalR;

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

// ── Gửi Đơn Hàng Qua HTTP POST (Đảm bảo 100% thành công trên mobile) ──
app.MapPost("/api/orders", async (RestaurantDbContext db, IHubContext<OrderHub> hubContext, OrderDto dto) =>
{
    var table = await db.Tables.FindAsync(dto.TableId);
    string tableName = table?.Name ?? $"Bàn {dto.TableId}";
    if (table != null)
    {
        table.IsOccupied = true;
    }

    var order = new Order
    {
        TableId = dto.TableId,
        TableName = tableName,
        OrderDetails = dto.OrderDetails,
        TotalAmount = dto.TotalAmount,
        CreatedAt = DateTime.UtcNow,
        IsPaid = false
    };

    db.Orders.Add(order);
    await db.SaveChangesAsync();

    // Phát SignalR từ server đến các màn hình Bếp và Thu ngân
    await hubContext.Clients.All.SendAsync("ReceiveNewOrder", dto.TableId, dto.OrderDetails, dto.TicketId, dto.TotalAmount, order.Id);

    return Results.Ok(order);
});

// ── Thu Ngân APIs ────────────────────────────────────────────────────
app.MapGet("/api/orders/active", async (RestaurantDbContext db) =>
    await db.Orders.Where(o => !o.IsPaid).ToListAsync());

app.MapGet("/api/invoices", async (RestaurantDbContext db) =>
    await db.Invoices.OrderByDescending(i => i.CreatedAt).ToListAsync());

// ── Quản Lý Thực Đơn CRUD ────────────────────────────────────────────
app.MapPost("/api/menu", async (RestaurantDbContext db, MenuItem item) =>
{
    db.MenuItems.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/menu/{item.Id}", item);
});

app.MapPut("/api/menu/{id}", async (RestaurantDbContext db, int id, MenuItem updatedItem) =>
{
    var item = await db.MenuItems.FindAsync(id);
    if (item == null) return Results.NotFound();
    
    item.Name = updatedItem.Name;
    item.Price = updatedItem.Price;
    item.Category = updatedItem.Category;
    item.ImageUrl = updatedItem.ImageUrl;
    item.IsHot = updatedItem.IsHot;
    
    await db.SaveChangesAsync();
    return Results.Ok(item);
});

app.MapDelete("/api/menu/{id}", async (RestaurantDbContext db, int id) =>
{
    var item = await db.MenuItems.FindAsync(id);
    if (item == null) return Results.NotFound();
    
    db.MenuItems.Remove(item);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã xóa món ăn thành công" });
});

// ── Thống Kê Doanh Thu ───────────────────────────────────────────────
app.MapGet("/api/stats/revenue", async (RestaurantDbContext db) =>
{
    var invoices = await db.Invoices.ToListAsync();
    double totalRevenue = invoices.Sum(i => i.TotalAmount);
    int totalInvoices = invoices.Count;

    // Phân tích món ăn bán chạy nhất từ chuỗi OrderDetails
    var itemCounts = new Dictionary<string, int>();
    foreach (var inv in invoices)
    {
        var parts = inv.OrderDetails.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var cleanPart = part.Trim();
            var xIndex = cleanPart.IndexOf('x');
            if (xIndex > 0)
            {
                var qtyStr = cleanPart.Substring(0, xIndex).Trim();
                var nameStr = cleanPart.Substring(xIndex + 1).Trim();
                if (int.TryParse(qtyStr, out int qty))
                {
                    if (itemCounts.ContainsKey(nameStr))
                        itemCounts[nameStr] += qty;
                    else
                        itemCounts[nameStr] = qty;
                }
            }
        }
    }

    var bestSellers = itemCounts
        .OrderByDescending(kv => kv.Value)
        .Take(5)
        .Select(kv => new { Name = kv.Key, Quantity = kv.Value })
        .ToList();

    return Results.Ok(new
    {
        TotalRevenue = totalRevenue,
        TotalInvoices = totalInvoices,
        BestSellers = bestSellers
    });
});

// ── Chạy với PORT từ môi trường (Railway cung cấp) ───────────────────
var port = Environment.GetEnvironmentVariable("PORT") ?? "5296";
app.Run($"http://0.0.0.0:{port}");

public record OrderDto(int TableId, string OrderDetails, string TicketId, double TotalAmount);
