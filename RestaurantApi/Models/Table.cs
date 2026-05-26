namespace RestaurantApi.Models
{
    public class Table
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsOccupied { get; set; }
    }
}
