using System;

namespace RestaurantApi.Models
{
    public class Invoice
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string OrderDetails { get; set; } = string.Empty;
        public double TotalAmount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow.AddHours(7);
        public string PaymentMethod { get; set; } = "Tiền mặt";
    }
}
