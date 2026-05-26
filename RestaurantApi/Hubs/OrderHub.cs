using Microsoft.AspNetCore.SignalR;
using RestaurantApi.Data;
using System.Threading.Tasks;

namespace RestaurantApi.Hubs
{
    public class OrderHub : Hub
    {
        private readonly RestaurantDbContext _db;

        public OrderHub(RestaurantDbContext db)
        {
            _db = db;
        }

        public async Task SendNewOrder(int tableId, string orderDetails, string ticketId)
        {
            var table = await _db.Tables.FindAsync(tableId);
            if (table != null)
            {
                table.IsOccupied = true;
                await _db.SaveChangesAsync();
            }
            await Clients.All.SendAsync("ReceiveNewOrder", tableId, orderDetails, ticketId);
        }

        public async Task MarkItemCooked(string ticketId, int tableId)
        {
            await Clients.All.SendAsync("ItemCooked", ticketId, tableId);
        }
        
        public async Task CheckoutTable(int tableId)
        {
            var table = await _db.Tables.FindAsync(tableId);
            if (table != null)
            {
                table.IsOccupied = false;
                await _db.SaveChangesAsync();
            }
            await Clients.All.SendAsync("TableCheckedOut", tableId);
        }
    }
}
