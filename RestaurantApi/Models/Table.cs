namespace RestaurantApi.Models
{
    public class Table
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsOccupied { get; set; }
        public string Type { get; set; } = "Standard"; // Standard or VIP
        public double ServiceCharge { get; set; } = 0; // Extra charge for VIP rooms/tables
        public string CurrentSessionToken { get; set; } = Guid.NewGuid().ToString("N").Substring(0, 8); // Random default token
    }
}
