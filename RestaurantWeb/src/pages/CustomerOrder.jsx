import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, signalRService } from '../services/api';

export default function CustomerOrder() {
  const { tableId } = useParams();
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token') || '';

  const [table, setTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderedHistory, setOrderedHistory] = useState([]);
  const sliderRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadOrderedHistory = () => {
    api.getActiveOrders().then(orders => {
      const tableOrders = orders.filter(o => o.tableId === parseInt(tableId));
      setOrderedHistory(tableOrders);
    });
  };

  useEffect(() => {
    // Kết nối SignalR để đồng bộ tức thời khi thanh toán bàn
    signalRService.startConnection();
    
    const handleCheckout = (tId) => {
      if (tId === parseInt(tableId)) {
        setOrderedHistory([]);
      }
    };
    signalRService.on("TableCheckedOut", handleCheckout);

    api.getTables().then(tables => {
      const found = tables.find(t => t.id === parseInt(tableId));
      setTable(found || { id: parseInt(tableId), name: `Bàn ${tableId}`, currentSessionToken: '' });
    });
    api.getMenuItems().then(setMenuItems);
    loadOrderedHistory();

    // Định kỳ quét lấy danh sách món để đảm bảo đồng bộ hoàn hảo
    const interval = setInterval(loadOrderedHistory, 8000);

    return () => {
      signalRService.off("TableCheckedOut", handleCheckout);
      clearInterval(interval);
    };
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
      await api.placeOrder({
        tableId: parseInt(tableId),
        orderDetails,
        ticketId,
        totalAmount,
        isApproved: false,
        token: urlToken
      });
      setOrdered(true);
      setCart([]);
      setShowCart(false);
      loadOrderedHistory();
    } catch (err) {
      showToast('Lỗi kết nối. Vui lòng thử lại!', 'error');
    }
  };

  // ── KIỂM TRA BẢO MẬT: XÁC THỰC MÃ PHIÊN QR CODE ──
  if (!table) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '15px' }}>
        <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Đang xác thực thông tin bàn ăn...</p>
      </div>
    );
  }

  if (table && urlToken !== table.currentSessionToken) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
        background: 'linear-gradient(135deg, #090d16 0%, #111827 100%)', color: '#fff'
      }}>
        <div className="glass-panel animate-slide-up" style={{ padding: '3.5rem 2rem', maxWidth: '420px', borderTop: '4px solid var(--danger-color)' }}>
          <div style={{ fontSize: '4.5rem', marginBottom: '1.5rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem', color: 'var(--danger-color)', fontWeight: 800 }}>
            Mã QR Hết Hạn!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7, fontSize: '0.95rem' }}>
            Mã QR của <strong>{table.name}</strong> đã hết hạn hoặc phiên phục vụ trước đã kết thúc.<br />
            Vui lòng quét lại **Mã QR mới** tại bàn để bắt đầu gọi món! 🙏
          </p>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            ID: {table.id} | Code: ERR_QR_SESSION_EXPIRED
          </div>
        </div>
      </div>
    );
  }

  if (ordered) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,20,20,0.9))', color: '#fff'
      }}>
        <div className="glass-panel animate-slide-up" style={{ padding: '3rem 2rem', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            fontSize: '4.5rem', marginBottom: '1.5rem',
            animation: 'pulse 2s infinite ease-in-out'
          }}>⏳</div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '1rem', color: '#fbbf24' }}>
            Đã Gửi Yêu Cầu!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7, fontSize: '0.95rem' }}>
            Món ăn đang chờ <strong>Nhân viên phục vụ</strong> tại bàn phê duyệt để chuyển xuống nhà bếp.<br />Vui lòng đợi giây lát, chúng tôi sẽ chế biến ngay! ☕
          </p>
          <button
            className="glass-button btn-success"
            style={{ padding: '14px 32px', fontSize: '1.05rem', fontWeight: 700, width: '100%' }}
            onClick={() => setOrdered(false)}
          >
            ➕ Tiếp Tục Xem Thực Đơn
          </button>
        </div>
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

      {/* Danh sách món đã gọi trước đó */}
      {orderedHistory.length > 0 && (
        <div style={{
          margin: '1.25rem', padding: '15px', borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>
              Danh Sách Món Ăn Đã Đặt
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orderedHistory.map((order, idx) => (
              <div key={order.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingBottom: '8px', borderBottom: '1px dotted rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: order.isApproved ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                    {order.orderDetails}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: order.isApproved ? 'var(--success-color)' : '#fbbf24', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {order.isApproved ? '🟢 Đã duyệt & đang nấu' : '⏳ Đang chờ nhân viên duyệt...'}
                  </span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
              <span>Tổng cộng:</span>
              <span style={{ color: '#fbbf24' }}>
                {orderedHistory.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()} đ
              </span>
            </div>
          </div>
        </div>
      )}

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
