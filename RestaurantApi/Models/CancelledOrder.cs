using System;

namespace RestaurantApi.Models
{
    public class CancelledOrder
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public double Price { get; set; }
        public DateTime CancelledAt { get; set; } = DateTime.UtcNow.AddHours(7);
        public string Reason { get; set; } = "Khách hủy món";
    }
}
