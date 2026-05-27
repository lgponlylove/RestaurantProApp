using Microsoft.EntityFrameworkCore;
using RestaurantApi.Data;
using RestaurantApi.Hubs;
using RestaurantApi.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();

// ── Database: SQLite (bền vững khi restart) ──────────────────────────
var dbPath = Path.Combine(builder.Environment.ContentRootPath, "restaurant.db");
builder.Services.AddDbContext<RestaurantDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// ── SignalR ───────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── JWT Bearer Authentication & Authorization ────────────────────────
var jwtSecret = builder.Configuration["JwtSecret"] ?? "RestaurantProVerySecretKeyForSigningJWTs2026!!!";
var key = Encoding.ASCII.GetBytes(jwtSecret);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});
builder.Services.AddAuthorization();

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
app.UseAuthentication();
app.UseAuthorization();

// ── SignalR Hub ───────────────────────────────────────────────────────
app.MapHub<OrderHub>("/orderHub");

// ── Auth APIs ────────────────────────────────────────────────────────
app.MapPost("/api/auth/login", async (RestaurantDbContext db, LoginDto dto) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.ToLower());
    if (user == null || !SecurityUtils.VerifyPassword(dto.Password, user.PasswordHash))
    {
        return Results.Json(new { message = "Sai tài khoản hoặc mật khẩu!" }, statusCode: 401);
    }

    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.ASCII.GetBytes(jwtSecret);

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role)
        }),
        Expires = DateTime.UtcNow.AddDays(7),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };

    var token = tokenHandler.CreateToken(tokenDescriptor);
    var tokenString = tokenHandler.WriteToken(token);

    return Results.Ok(new
    {
        token = tokenString,
        username = user.Username,
        role = user.Role
    });
});

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
        CreatedAt = DateTime.UtcNow.AddHours(7),
        IsPaid = false
    };

    db.Orders.Add(order);
    await db.SaveChangesAsync();

    // Phát SignalR từ server đến các màn hình Bếp và Thu ngân
    await hubContext.Clients.All.SendAsync("ReceiveNewOrder", dto.TableId, dto.OrderDetails, dto.TicketId, dto.TotalAmount, order.Id);

    return Results.Ok(order);
});

// ── Hủy Một Đơn Hàng Cụ Thể (Yêu cầu quyền Quản lý/Thu ngân) ─────────
app.MapDelete("/api/orders/{id}", async (RestaurantDbContext db, IHubContext<OrderHub> hubContext, int id) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();

    int tableId = order.TableId;

    // Phân tách các món hủy để lưu nhật ký chống gian lận
    var parts = order.OrderDetails.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries);
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
                var menuItem = await db.MenuItems.FirstOrDefaultAsync(m => m.Name.ToLower() == nameStr.ToLower());
                double price = menuItem != null ? (double)menuItem.Price : 0;

                var cancelledLog = new CancelledOrder
                {
                    TableId = order.TableId,
                    TableName = order.TableName,
                    ItemName = nameStr,
                    Quantity = qty,
                    Price = price,
                    CancelledAt = DateTime.UtcNow.AddHours(7),
                    Reason = "Hủy toàn bộ đơn hàng"
                };
                db.CancelledOrders.Add(cancelledLog);
            }
        }
    }

    db.Orders.Remove(order);
    
    // Nếu đây là đơn hàng cuối cùng của bàn, đánh dấu bàn là Trống
    var remainingOrders = await db.Orders.CountAsync(o => o.TableId == tableId && !o.IsPaid && o.Id != id);
    if (remainingOrders == 0)
    {
        var table = await db.Tables.FindAsync(tableId);
        if (table != null)
        {
            table.IsOccupied = false;
        }
    }

    await db.SaveChangesAsync();

    // Phát SignalR để tất cả thiết bị (Bếp, Khách 4G, Phục vụ) đồng bộ lại ngay
    await hubContext.Clients.All.SendAsync("TableCheckedOut", tableId);

    return Results.Ok(new { message = "Đã hủy món thành công" });
}).RequireAuthorization();

// ── Cập Nhật Chi Tiết Đơn Hàng (Cho phép Hủy từng món lẻ) ─────────────
app.MapPut("/api/orders/{id}", async (RestaurantDbContext db, IHubContext<OrderHub> hubContext, int id, UpdateOrderDto dto) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();

    int tableId = order.TableId;
    order.OrderDetails = dto.OrderDetails;
    order.TotalAmount = dto.TotalAmount;

    // Lưu nhật ký hủy món lẻ nếu có
    if (!string.IsNullOrEmpty(dto.CancelledItemName) && dto.CancelledQty > 0)
    {
        var cancelledLog = new CancelledOrder
        {
            TableId = tableId,
            TableName = order.TableName,
            ItemName = dto.CancelledItemName,
            Quantity = dto.CancelledQty,
            Price = dto.CancelledPrice,
            CancelledAt = DateTime.UtcNow.AddHours(7),
            Reason = string.IsNullOrEmpty(dto.Reason) ? "Khách hủy món lẻ" : dto.Reason
        };
        db.CancelledOrders.Add(cancelledLog);
    }

    // Nếu không còn món nào trong hóa đơn chi tiết, xóa luôn đơn hàng khỏi DB
    if (string.IsNullOrWhiteSpace(order.OrderDetails))
    {
        db.Orders.Remove(order);
        
        // Kiểm tra xem đây có phải đơn cuối cùng của bàn không
        var remainingOrders = await db.Orders.CountAsync(o => o.TableId == tableId && !o.IsPaid && o.Id != id);
        if (remainingOrders == 0)
        {
            var table = await db.Tables.FindAsync(tableId);
            if (table != null)
            {
                table.IsOccupied = false;
            }
        }
    }

    await db.SaveChangesAsync();

    // Đồng bộ lại trạng thái của tất cả màn hình (Bếp, Khách, Nhân viên)
    await hubContext.Clients.All.SendAsync("TableCheckedOut", tableId);

    return Results.Ok(order);
}).RequireAuthorization();

app.MapGet("/api/orders/active", async (RestaurantDbContext db) =>
    await db.Orders.Where(o => !o.IsPaid).ToListAsync()).RequireAuthorization();

app.MapGet("/api/invoices", async (RestaurantDbContext db) =>
    await db.Invoices.OrderByDescending(i => i.CreatedAt).ToListAsync()).RequireAuthorization();

// ── Nhật Ký Hủy Món (Security Audit Log) ─────────────────────────────
app.MapGet("/api/cancelled-orders", async (RestaurantDbContext db) =>
    await db.CancelledOrders.OrderByDescending(c => c.CancelledAt).ToListAsync()).RequireAuthorization();

app.MapPost("/api/menu", async (RestaurantDbContext db, MenuItem item) =>
{
    db.MenuItems.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/menu/{item.Id}", item);
}).RequireAuthorization();

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
}).RequireAuthorization();

app.MapDelete("/api/menu/{id}", async (RestaurantDbContext db, int id) =>
{
    var item = await db.MenuItems.FindAsync(id);
    if (item == null) return Results.NotFound();
    
    db.MenuItems.Remove(item);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã xóa món ăn thành công" });
}).RequireAuthorization();

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
}).RequireAuthorization();

// ── Chạy với PORT từ môi trường (Railway cung cấp) ───────────────────
var port = Environment.GetEnvironmentVariable("PORT") ?? "5296";
app.Run($"http://0.0.0.0:{port}");

public record OrderDto(int TableId, string OrderDetails, string TicketId, double TotalAmount);
public record UpdateOrderDto(string OrderDetails, double TotalAmount, string? CancelledItemName = null, int CancelledQty = 0, double CancelledPrice = 0, string? Reason = null);
public record LoginDto(string Username, string Password);
