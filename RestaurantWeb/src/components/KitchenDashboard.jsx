import { signalRService } from '../services/api';

export default function KitchenDashboard({ tickets, setTickets, showToast }) {
  const markAsCooked = async (ticket) => {
    try {
      await signalRService.markItemCooked(ticket.id, ticket.tableId); 
      setTickets(prev => prev.filter(t => t.id !== ticket.id));
      showToast('Đã báo nấu xong!');
    } catch (err) {
      showToast('Lỗi kết nối máy chủ!', 'error');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '2rem' }}>👨‍🍳 Danh Sách Chờ Nấu</h2>
      
      {tickets.length === 0 ? (
        <div className="glass-panel flex-center" style={{ height: '200px' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Không có món nào đang chờ.</p>
        </div>
      ) : (
        <div className="grid-auto">
          {tickets.map(ticket => (
            <div key={ticket.id} className="glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <h3 style={{ marginBottom: '10px', color: 'var(--primary-color)' }}>Bàn {ticket.tableId}</h3>
              <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>{ticket.orderDetails}</p>
              <button 
                className="glass-button btn-success" 
                style={{ width: '100%' }}
                onClick={() => markAsCooked(ticket)}
              >
                ✅ Đã Nấu Xong
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
