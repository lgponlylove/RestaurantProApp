import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';

export default function MenuOrder({ table, onBack, cart, updateCart, clearCart, showToast }) {
  const [menuItems, setMenuItems] = useState([]);

  const [orderedHistory, setOrderedHistory] = useState([]);

  const loadOrderedHistory = () => {
    api.getTableOrders(table.id).then(orders => {
      setOrderedHistory(orders);
    }).catch(err => console.error("Error loading table orders", err));
  };

  useEffect(() => {
    api.getMenuItems().then(setMenuItems);
    loadOrderedHistory();

    const handleNewOrder = () => loadOrderedHistory();
    const handlePending = () => loadOrderedHistory();
    const handleItemCooked = () => loadOrderedHistory();

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("ReceivePendingOrder", handlePending);
    signalRService.on("ItemCooked", handleItemCooked);

    const interval = setInterval(loadOrderedHistory, 3000);

    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("ReceivePendingOrder", handlePending);
      signalRService.off("ItemCooked", handleItemCooked);
      clearInterval(interval);
    };
  }, [table.id]);

  const normalizedCart = cart.map(i => ({
    ...i,
    uniqueId: i.uniqueId || Math.random().toString(),
    status: i.status || 'new'
  }));

  const formatTime = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const addToCart = (item) => {
    const existing = normalizedCart.find(i => i.id === item.id && i.status === 'new');
    if (existing) {
      updateCart(normalizedCart.map(i => i.uniqueId === existing.uniqueId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      updateCart([...normalizedCart, { ...item, uniqueId: Math.random().toString(), quantity: 1, status: 'new', ticketId: null, addedAt: new Date().toISOString() }]);
    }
  };

  const removeFromCart = (uniqueId) => {
    updateCart(normalizedCart.filter(i => i.uniqueId !== uniqueId));
  };

  const newItemsAmount = normalizedCart.filter(i => i.status === 'new').reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderedAmount = orderedHistory.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalAmount = newItemsAmount + orderedAmount;
  const hasNewItems = normalizedCart.some(i => i.status === 'new');

  const hotItems = menuItems.filter(i => i.isHot);

  const sendToKitchen = async () => {
    const newItems = normalizedCart.filter(i => i.status === 'new');
    if (newItems.length === 0) return;
    try {
      const ticketId = Date.now().toString();
      const orderDetails = newItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const newItemsTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const updatedCart = normalizedCart.map(i => i.status === 'new' ? { ...i, status: 'cooking', ticketId } : i);
      updateCart(updatedCart);
      await signalRService.sendNewOrder(table.id, orderDetails, ticketId, newItemsTotal);
      showToast('Đã đặt món thành công!');
      onBack();
    } catch (err) {
      showToast('Lỗi kết nối máy chủ! Đang thử lại...', 'error');
      console.error(err);
    }
  };

  const handleRequestCheckout = async () => {
    try {
      await signalRService.requestCheckout(table.id);
      showToast('🛎️ Đã gửi yêu cầu thanh toán! Thu ngân đang chuẩn bị hóa đơn...');
      onBack();
    } catch (err) {
      showToast('Lỗi gửi yêu cầu thanh toán!', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      {/* Cột trái: Thực đơn */}
      <div style={{ flex: 2, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem' }}>🍽 Thực Đơn — {table.name}</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="glass-button btn-danger"
              onClick={() => {
                const pin = window.prompt('Hành động này cần quyền Quản lý. Vui lòng nhập mã PIN:');
                if (pin === '1234') {
                  clearCart();
                  signalRService.checkoutTable(table.id);
                  showToast('Đã xóa dữ liệu bàn thành công!');
                  onBack();
                } else if (pin !== null) {
                  showToast('Sai mã PIN!', 'error');
                }
              }}
            >
              🗑 Xóa Trắng Bàn
            </button>
            <button className="glass-button" onClick={onBack}>⬅ Quay lại</button>
          </div>
        </div>

        {/* Hot Slider */}
        {hotItems.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔥</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316' }}>Món Đang Hot</h3>
            </div>
            <div className="hot-slider">
              {hotItems.map(item => (
                <div key={item.id} className="hot-slide" onClick={() => addToCart(item)}>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'; }}
                  />
                  <div className="hot-slide-info">
                    <div className="hot-badge">🔥 Hot</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                    <div style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600 }}>
                      {item.price.toLocaleString()} đ
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Tất Cả Món Ăn
        </h3>
        <div className="grid-auto">
          {menuItems.map(item => (
            <div key={item.id} className="menu-card">
              <img
                className="menu-card-img"
                src={item.imageUrl}
                alt={item.name}
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'; }}
              />
              <div className="menu-card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>{item.name}</h3>
                  {item.isHot && <span className="hot-badge">🔥 Hot</span>}
                </div>
                <p style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '1rem' }}>
                  {item.price.toLocaleString()} đ
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.category}</p>
                <button
                  className="glass-button btn-primary"
                  style={{ marginTop: 'auto', width: '100%' }}
                  onClick={() => addToCart(item)}
                >
                  ➕ Thêm vào giỏ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cột phải: Giỏ hàng */}
      <div style={{ flex: '0 0 330px' }}>
        <div className="glass-panel" style={{ position: 'sticky', top: '2rem' }}>
          <h2 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
            🛒 Trạng Thái Bàn
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '55vh', overflowY: 'auto' }}>
            
            {/* PHẦN 1: MÓN MỚI CHỌN (CHƯA GỬI BẾP) */}
            <div>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--primary-color)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                <span>🛒 Món Mới Chọn</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {normalizedCart.filter(i => i.status === 'new').length} món
                </span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {normalizedCart.filter(i => i.status === 'new').map(item => (
                  <div key={item.uniqueId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ color: 'var(--primary-color)' }}>{item.quantity}x</span> {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--success-color)' }}>
                        {(item.price * item.quantity).toLocaleString()} đ
                      </div>
                    </div>
                    <button
                      className="glass-button btn-danger"
                      style={{ padding: '3px 8px', fontSize: '0.7rem', flexShrink: 0, height: '24px', borderRadius: '4px' }}
                      onClick={() => removeFromCart(item.uniqueId)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {normalizedCart.filter(i => i.status === 'new').length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', padding: '4px 0' }}>Chưa chọn món mới</p>
                )}
              </div>
            </div>

            {/* PHẦN 2: MÓN ĐANG PHỤC VỤ (ĐÃ GỬI BẾP) */}
            <div>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--success-color)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📋 Món Đang Phục Vụ</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {orderedHistory.length} đơn
                </span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedHistory.map((order, idx) => (
                  <div key={order.id || idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '8px 10px', background: 'rgba(255,255,255,0.01)', border: '1px dotted rgba(255,255,255,0.1)', borderRadius: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: order.isApproved ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                        {order.orderDetails}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: order.isApproved ? 'var(--success-color)' : '#fbbf24' }}>
                          {order.isApproved ? '✅ Đã nấu xong' : '⏳ Chờ duyệt...'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          🕐 {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {orderedHistory.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', padding: '4px 0' }}>Chưa có món nào đang nấu</p>
                )}
              </div>
            </div>

          </div>

          {/* PHẦN TỔNG HỢP & NÚT THAO TÁC */}
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ color: '#fbbf24', textAlign: 'right', marginBottom: '1rem', fontSize: '1.1rem' }}>
              Tổng: {totalAmount.toLocaleString()} đ
            </h3>
            
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              {hasNewItems && (
                <button className="glass-button btn-success" style={{ width: '100%', padding: '12px', fontWeight: 700 }} onClick={sendToKitchen}>
                  🍳 Đặt Món & Gửi Bếp
                </button>
              )}
              {(table.isOccupied || normalizedCart.some(i => i.status !== 'new')) && (
                <button className="glass-button btn-danger" style={{ width: '100%', padding: '12px', fontWeight: 700 }} onClick={handleRequestCheckout}>
                  💳 Yêu Cầu Thanh Toán
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
