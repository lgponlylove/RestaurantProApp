using Microsoft.EntityFrameworkCore;
using RestaurantApi.Models;

namespace RestaurantApi.Data
{
    public class RestaurantDbContext : DbContext
    {
        public RestaurantDbContext(DbContextOptions<RestaurantDbContext> options) : base(options) { }

        public DbSet<Table> Tables { get; set; }
        public DbSet<MenuItem> MenuItems { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<CancelledOrder> CancelledOrders { get; set; }
        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Seed Data — chạy khi migration lần đầu
            modelBuilder.Entity<Table>().HasData(
                new Table { Id = 1, Name = "Bàn 1", IsOccupied = false, Type = "Standard", ServiceCharge = 0, CurrentSessionToken = "d8a3c9b2" },
                new Table { Id = 2, Name = "Bàn 2", IsOccupied = false, Type = "Standard", ServiceCharge = 0, CurrentSessionToken = "e7b1f5a4" },
                new Table { Id = 3, Name = "Bàn 3", IsOccupied = false, Type = "Standard", ServiceCharge = 0, CurrentSessionToken = "9c2d8e3f" },
                new Table { Id = 4, Name = "Phòng VIP 1", IsOccupied = false, Type = "VIP", ServiceCharge = 100000, CurrentSessionToken = "f4a5c9d1" },
                new Table { Id = 5, Name = "Phòng VIP 2", IsOccupied = false, Type = "VIP", ServiceCharge = 150000, CurrentSessionToken = "b8e2f6a7" }
            );

            modelBuilder.Entity<MenuItem>().HasData(
                new MenuItem { Id = 1, Name = "Mực Hấp Gừng", Price = 150000, Category = "Hải Sản",
                    ImageUrl = "https://images.unsplash.com/photo-1559742811-822873691df8?w=600&q=80",
                    IsHot = false },
                new MenuItem { Id = 2, Name = "Tôm Hùm Nướng Phô Mai", Price = 550000, Category = "Hải Sản",
                    ImageUrl = "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=600&q=80",
                    IsHot = true },
                new MenuItem { Id = 3, Name = "Lẩu Thái Tomyum", Price = 250000, Category = "Lẩu",
                    ImageUrl = "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80",
                    IsHot = true },
                new MenuItem { Id = 4, Name = "Lẩu Nấm Chim Câu", Price = 300000, Category = "Lẩu",
                    ImageUrl = "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
                    IsHot = false },
                new MenuItem { Id = 5, Name = "Bò Tảng Nướng", Price = 200000, Category = "Đồ Nướng",
                    ImageUrl = "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80",
                    IsHot = true },
                new MenuItem { Id = 6, Name = "Sườn Nướng BBQ", Price = 180000, Category = "Đồ Nướng",
                    ImageUrl = "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
                    IsHot = true },
                new MenuItem { Id = 7, Name = "Bia Heineken", Price = 25000, Category = "Đồ Uống",
                    ImageUrl = "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80",
                    IsHot = false },
                new MenuItem { Id = 8, Name = "Nước Ép Dưa Hấu", Price = 35000, Category = "Đồ Uống",
                    ImageUrl = "https://images.unsplash.com/photo-1622597467836-f3e6707fd04f?w=600&q=80",
                    IsHot = false }
            );

            modelBuilder.Entity<User>().HasData(
                new User { Id = 1, Username = "admin", PasswordHash = SecurityUtils.HashPassword("admin123"), Role = "Admin" },
                new User { Id = 2, Username = "cashier", PasswordHash = SecurityUtils.HashPassword("cashier123"), Role = "Cashier" },
                new User { Id = 3, Username = "kitchen", PasswordHash = SecurityUtils.HashPassword("kitchen123"), Role = "Kitchen" }
            );
        }
    }
}
