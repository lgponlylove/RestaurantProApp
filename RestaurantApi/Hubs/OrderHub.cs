using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RestaurantApi.Data;
using RestaurantApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
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

        public async Task SendNewOrder(int tableId, string orderDetails, string ticketId, double totalAmount)
        {
            var table = await _db.Tables.FindAsync(tableId);
            string tableName = table?.Name ?? $"Bàn {tableId}";
            if (table != null)
            {
                table.IsOccupied = true;
            }

            // Lưu order mới vào CSDL SQLite
            var order = new Order
            {
                TableId = tableId,
                TableName = tableName,
                OrderDetails = orderDetails,
                TotalAmount = totalAmount,
                CreatedAt = DateTime.UtcNow.AddHours(7),
                IsPaid = false
            };
            _db.Orders.Add(order);
            await _db.SaveChangesAsync();

            // Phát thông tin thời gian thực đến tất cả các client
            await Clients.All.SendAsync("ReceiveNewOrder", tableId, orderDetails, ticketId, totalAmount, order.Id);
        }

        public async Task MarkItemCooked(string ticketId, int tableId)
        {
            await Clients.All.SendAsync("ItemCooked", ticketId, tableId);
        }

        public async Task RequestCheckout(int tableId)
        {
            var table = await _db.Tables.FindAsync(tableId);
            string tableName = table?.Name ?? $"Bàn {tableId}";
            await Clients.All.SendAsync("ReceiveCheckoutRequest", tableId, tableName);
        }
        
        public async Task CheckoutTable(int tableId, string paymentMethod)

        {
            var table = await _db.Tables.FindAsync(tableId);
            if (table != null)
            {
                table.IsOccupied = false;
                table.CurrentSessionToken = Guid.NewGuid().ToString("N").Substring(0, 8); // Vô hiệu hóa mã QR cũ tức thì!
            }

            // Lấy toàn bộ đơn hàng chưa thanh toán của bàn này
            var pendingOrders = await _db.Orders
                .Where(o => o.TableId == tableId && !o.IsPaid)
                .ToListAsync();

            if (pendingOrders.Any())
            {
                double totalBill = 0;
                var details = new List<string>();

                foreach (var order in pendingOrders)
                {
                    order.IsPaid = true;
                    totalBill += order.TotalAmount;
                    details.Add(order.OrderDetails);
                }

                // Tạo hóa đơn lưu trữ lịch sử
                var invoice = new Invoice
                {
                    TableId = tableId,
                    TableName = table?.Name ?? $"Bàn {tableId}",
                    OrderDetails = string.Join("; ", details),
                    TotalAmount = totalBill,
                    CreatedAt = DateTime.UtcNow.AddHours(7),
                    PaymentMethod = string.IsNullOrEmpty(paymentMethod) ? "Tiền mặt" : paymentMethod
                };
                _db.Invoices.Add(invoice);
            }

            await _db.SaveChangesAsync();
            await Clients.All.SendAsync("TableCheckedOut", tableId);
        }
    }
}
