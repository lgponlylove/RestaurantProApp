using System;

namespace RestaurantApi.Models
{
    public class Order
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string OrderDetails { get; set; } = string.Empty; // Danh sách món dạng: "2x Mực Hấp, 1x Bia"
        public double TotalAmount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow.AddHours(7);
        public bool IsPaid { get; set; } = false;
    }
}
