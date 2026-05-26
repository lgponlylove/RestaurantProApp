using System.Collections.Generic;

namespace RestaurantApi.Models
{
    public class Order
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public List<OrderItem> Items { get; set; } = new List<OrderItem>();
    }
}
