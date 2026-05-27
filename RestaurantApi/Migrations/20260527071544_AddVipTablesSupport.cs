using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantApi.Migrations
{
    /// <inheritdoc />
    public partial class AddVipTablesSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "ServiceCharge",
                table: "Tables",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Tables",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "ServiceCharge", "Type" },
                values: new object[] { 0.0, "Standard" });

            migrationBuilder.UpdateData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "ServiceCharge", "Type" },
                values: new object[] { 0.0, "Standard" });

            migrationBuilder.UpdateData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "ServiceCharge", "Type" },
                values: new object[] { 0.0, "Standard" });

            migrationBuilder.UpdateData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "Name", "ServiceCharge", "Type" },
                values: new object[] { "Phòng VIP 1", 100000.0, "VIP" });

            migrationBuilder.InsertData(
                table: "Tables",
                columns: new[] { "Id", "IsOccupied", "Name", "ServiceCharge", "Type" },
                values: new object[] { 5, false, "Phòng VIP 2", 150000.0, "VIP" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DropColumn(
                name: "ServiceCharge",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Tables");

            migrationBuilder.UpdateData(
                table: "Tables",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Bàn 4");
        }
    }
}
