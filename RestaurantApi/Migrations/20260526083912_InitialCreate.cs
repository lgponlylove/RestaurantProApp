using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RestaurantApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MenuItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Price = table.Column<decimal>(type: "TEXT", nullable: false),
                    Category = table.Column<string>(type: "TEXT", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", nullable: false),
                    IsHot = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MenuItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TableId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    IsOccupied = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tables", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrderItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OrderId = table.Column<int>(type: "INTEGER", nullable: false),
                    MenuItemId = table.Column<int>(type: "INTEGER", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    IsCooked = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderItems_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderItems_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "MenuItems",
                columns: new[] { "Id", "Category", "ImageUrl", "IsHot", "Name", "Price" },
                values: new object[,]
                {
                    { 1, "Hải Sản", "https://images.unsplash.com/photo-1559742811-822873691df8?w=600&q=80", false, "Mực Hấp Gừng", 150000m },
                    { 2, "Hải Sản", "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=600&q=80", true, "Tôm Hùm Nướng Phô Mai", 550000m },
                    { 3, "Lẩu", "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80", true, "Lẩu Thái Tomyum", 250000m },
                    { 4, "Lẩu", "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80", false, "Lẩu Nấm Chim Câu", 300000m },
                    { 5, "Đồ Nướng", "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80", true, "Bò Tảng Nướng", 200000m },
                    { 6, "Đồ Nướng", "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80", true, "Sườn Nướng BBQ", 180000m },
                    { 7, "Đồ Uống", "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80", false, "Bia Heineken", 25000m },
                    { 8, "Đồ Uống", "https://images.unsplash.com/photo-1622597467836-f3e6707fd04f?w=600&q=80", false, "Nước Ép Dưa Hấu", 35000m }
                });

            migrationBuilder.InsertData(
                table: "Tables",
                columns: new[] { "Id", "IsOccupied", "Name" },
                values: new object[,]
                {
                    { 1, false, "Bàn 1" },
                    { 2, false, "Bàn 2" },
                    { 3, false, "Bàn 3" },
                    { 4, false, "Bàn 4" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_MenuItemId",
                table: "OrderItems",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_OrderId",
                table: "OrderItems",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderItems");

            migrationBuilder.DropTable(
                name: "Tables");

            migrationBuilder.DropTable(
                name: "MenuItems");

            migrationBuilder.DropTable(
                name: "Orders");
        }
    }
}
