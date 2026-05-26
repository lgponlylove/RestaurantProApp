import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';

export default function MenuOrder({ table, onBack, cart, updateCart, clearCart, showToast }) {
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    api.getMenuItems().then(setMenuItems);
  }, []);

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

  const totalAmount = normalizedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const hasNewItems = normalizedCart.some(i => i.status === 'new');
  const allCooked = normalizedCart.length > 0 && normalizedCart.every(i => i.status === 'cooked');

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

  const checkout = async () => {
    if (window.confirm(`Tổng số tiền là ${totalAmount.toLocaleString()} đ. Xác nhận thanh toán?`)) {
      try {
        await signalRService.checkoutTable(table.id);
        clearCart();
        showToast('Thanh toán thành công!');
        onBack();
      } catch (err) {
        showToast('Lỗi kết nối máy chủ!', 'error');
      }
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
      <div style={{ flex: '0 0 320px' }}>
        <div className="glass-panel" style={{ position: 'sticky', top: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>🛒 Giỏ hàng ({normalizedCart.reduce((s, i) => s + i.quantity, 0)})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
            {normalizedCart.map(item => (
              <div key={item.uniqueId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                paddingBottom: '8px', borderBottom: '1px solid var(--glass-border)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--primary-color)' }}>{item.quantity}x</span> {item.name}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success-color)' }}>
                    {item.price.toLocaleString()} đ × {item.quantity} = <strong>{(item.price * item.quantity).toLocaleString()} đ</strong>
                  </span>
                  <span style={{
                    fontSize: '0.75rem', fontStyle: 'italic',
                    color: item.status === 'new' ? 'var(--text-secondary)' : item.status === 'cooking' ? '#f97316' : 'var(--success-color)'
                  }}>
                    {item.status === 'new' && '⏳ Mới thêm'}
                    {item.status === 'cooking' && '🔥 Đang nấu'}
                    {item.status === 'cooked' && '✅ Đã nấu xong'}
                  </span>
                  {item.addedAt && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🕐 Đặt lúc: <strong>{formatTime(item.addedAt)}</strong>
                    </span>
                  )}
                </div>
                {item.status === 'new' && (
                  <button
                    className="glass-button btn-danger"
                    style={{ padding: '3px 9px', fontSize: '0.75rem', flexShrink: 0 }}
                    onClick={() => removeFromCart(item.uniqueId)}
                  >✕</button>
                )}
              </div>
            ))}
            {normalizedCart.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>Chưa có món nào</p>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ color: '#fbbf24', textAlign: 'right', marginBottom: '1rem' }}>
              Tổng: {totalAmount.toLocaleString()} đ
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              {hasNewItems && (
                <button className="glass-button btn-success" onClick={sendToKitchen}>
                  🍳 Đặt món
                </button>
              )}
              {table.isOccupied && allCooked && (
                <button className="glass-button btn-danger" onClick={checkout}>
                  💳 Thanh Toán
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
