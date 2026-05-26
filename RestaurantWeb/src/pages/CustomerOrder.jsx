import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, signalRService } from '../services/api';

export default function CustomerOrder() {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const sliderRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    signalRService.startConnection();
    api.getTables().then(tables => {
      const found = tables.find(t => t.id === parseInt(tableId));
      setTable(found || { id: parseInt(tableId), name: `Bàn ${tableId}` });
    });
    api.getMenuItems().then(setMenuItems);
  }, [tableId]);

  const hotItems = menuItems.filter(i => i.isHot);

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, addedAt: new Date().toISOString() }];
    });
    showToast(`Đã thêm ${item.name}!`);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const ticketId = Date.now().toString();
      const orderDetails = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
      await signalRService.sendNewOrder(parseInt(tableId), orderDetails, ticketId, totalAmount);
      setOrdered(true);
      setCart([]);
      setShowCart(false);
    } catch (err) {
      showToast('Lỗi kết nối. Vui lòng thử lại!', 'error');
    }
  };

  if (ordered) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✅</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }} className="text-gradient">
          Đã Gọi Món Thành Công!
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Nhà bếp đã nhận được yêu cầu của bạn.<br />Vui lòng chờ trong giây lát nhé! 🙏
        </p>
        <button
          className="glass-button btn-primary"
          style={{ padding: '14px 32px', fontSize: '1rem' }}
          onClick={() => setOrdered(false)}
        >
          ➕ Gọi thêm món
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '120px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
          color: 'white', padding: '10px 24px', borderRadius: '30px',
          boxShadow: 'var(--glass-shadow)', zIndex: 9999, fontWeight: 600,
          fontSize: '0.9rem', whiteSpace: 'nowrap', animation: 'slideUp 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(16,185,129,0.2))',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '1.25rem 1.5rem',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <h1 className="text-gradient" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
          🍽 Restaurant Pro
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
          {table?.name} — Chọn món bạn muốn thưởng thức
        </p>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* Hot Slider */}
        {hotItems.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316' }}>Món Đang Hot</h2>
            </div>
            <div ref={sliderRef} className="hot-slider">
              {hotItems.map(item => (
                <div key={item.id} className="hot-slide" style={{ flex: '0 0 260px' }} onClick={() => addToCart(item)}>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'; }}
                  />
                  <div className="hot-slide-info">
                    <div className="hot-badge">🔥 Hot</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                    <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.9rem' }}>
                      {item.price.toLocaleString()} đ
                    </div>
                    <div style={{
                      marginTop: '6px', background: 'rgba(255,255,255,0.2)',
                      borderRadius: '20px', padding: '4px 12px',
                      fontSize: '0.8rem', display: 'inline-block', fontWeight: 600
                    }}>
                      ➕ Nhấn để thêm
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Thực Đơn
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {menuItems.map(item => (
            <div key={item.id} className="menu-card" onClick={() => addToCart(item)} style={{ cursor: 'pointer' }}>
              <img
                className="menu-card-img"
                src={item.imageUrl}
                alt={item.name}
                style={{ height: '120px' }}
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'; }}
              />
              <div className="menu-card-body" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                  <h3 style={{ fontSize: '0.85rem', lineHeight: 1.3, flex: 1 }}>{item.name}</h3>
                  {item.isHot && <span className="hot-badge" style={{ fontSize: '0.6rem', flexShrink: 0 }}>🔥</span>}
                </div>
                <p style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '0.9rem', marginTop: '4px' }}>
                  {item.price.toLocaleString()} đ
                </p>
                <button
                  className="glass-button btn-primary"
                  style={{ width: '100%', marginTop: '8px', padding: '8px', fontSize: '0.8rem' }}
                  onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                >
                  ➕ Thêm
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Cart Button */}
      {totalQty > 0 && (
        <button
          onClick={() => setShowCart(true)}
          style={{
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, var(--primary-color), var(--success-color))',
            color: 'white', border: 'none', borderRadius: '30px',
            padding: '14px 28px', fontSize: '1rem', fontWeight: 700,
            boxShadow: '0 8px 32px rgba(59,130,246,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px',
            zIndex: 200, animation: 'slideUp 0.3s ease-out'
          }}
        >
          🛒 Xem giỏ hàng
          <span style={{
            background: 'rgba(255,255,255,0.3)', borderRadius: '50%',
            width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.9rem'
          }}>
            {totalQty}
          </span>
        </button>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowCart(false)}>
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--bg-color)', borderTop: '1px solid var(--glass-border)',
              borderRadius: '24px 24px 0 0', padding: '1.5rem',
              maxHeight: '80vh', overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px', margin: '0 auto 1.5rem' }} />
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>🛒 Giỏ hàng của bạn</h2>

            {cart.map(item => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid var(--glass-border)'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.quantity}x {item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', marginTop: '2px' }}>
                    {(item.price * item.quantity).toLocaleString()} đ
                    {item.addedAt && <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>· {formatTime(item.addedAt)}</span>}
                  </div>
                </div>
                <button
                  className="glass-button btn-danger"
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => removeFromCart(item.id)}
                >✕</button>
              </div>
            ))}

            <div style={{ padding: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tổng cộng:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>{totalAmount.toLocaleString()} đ</span>
            </div>

            <button
              className="glass-button btn-success"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: 700, marginTop: '0.5rem' }}
              onClick={placeOrder}
            >
              🍳 Xác nhận gọi món
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
