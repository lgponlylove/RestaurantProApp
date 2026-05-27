import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function ManagerDashboard({ showToast }) {
  const [menuItems, setMenuItems] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalInvoices: 0, bestSellers: [] });
  const [activeSubTab, setActiveSubTab] = useState("menu"); // menu, stats, cancelled hoặc tables
  const [cancelledOrders, setCancelledOrders] = useState([]);
  
  // Trạng thái Quản lý Bàn ăn / Phòng VIP
  const [tables, setTables] = useState([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableFormData, setTableFormData] = useState({
    name: "",
    type: "Standard",
    serviceCharge: 0
  });
  
  // Trạng thái Form thêm/sửa món
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    category: "Hải Sản",
    imageUrl: "",
    isHot: false
  });

  useEffect(() => {
    loadMenu();
    loadStats();
    loadCancelledOrders();
    loadTables();
  }, []);

  const loadTables = () => {
    api.getTables()
      .then(setTables)
      .catch(err => console.error("Lỗi tải bàn ăn:", err));
  };

  const loadCancelledOrders = () => {
    api.getCancelledOrders()
      .then(setCancelledOrders)
      .catch(err => console.error("Lỗi tải nhật ký hủy:", err));
  };

  const handleOpenAddTableModal = () => {
    setEditingTable(null);
    setTableFormData({
      name: "",
      type: "Standard",
      serviceCharge: 0
    });
    setShowTableModal(true);
  };

  const handleOpenEditTableModal = (table) => {
    setEditingTable(table);
    setTableFormData({
      name: table.name,
      type: table.type || "Standard",
      serviceCharge: table.serviceCharge || 0
    });
    setShowTableModal(true);
  };

  const handleTableFormSubmit = async (e) => {
    e.preventDefault();
    if (!tableFormData.name) {
      showToast("Tên bàn/phòng phải hợp lệ!", "error");
      return;
    }

    try {
      const payload = {
        name: tableFormData.name,
        type: tableFormData.type,
        serviceCharge: tableFormData.serviceCharge
      };

      if (editingTable) {
        await api.editTable(editingTable.id, payload);
        showToast("Cập nhật thông tin bàn thành công!");
      } else {
        await api.addTable(payload);
        showToast("Thêm bàn/phòng mới thành công!");
      }
      setShowTableModal(false);
      loadTables();
    } catch (err) {
      showToast("Thao tác thất bại. Vui lòng kiểm tra lại!", "error");
    }
  };

  const handleDeleteTable = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${name}" khỏi sơ đồ nhà hàng?`)) {
      try {
        await api.deleteTable(id);
        showToast("Đã xóa bàn ăn thành công!");
        loadTables();
      } catch (err) {
        showToast("Lỗi khi xóa bàn ăn!", "error");
      }
    }
  };

  const loadMenu = () => {
    api.getMenuItems().then(setMenuItems);
  };

  const loadStats = () => {
    api.getRevenueStats().then(data => {
      setStats({
        totalRevenue: data.totalRevenue || 0,
        totalInvoices: data.totalInvoices || 0,
        bestSellers: data.bestSellers || []
      });
    });
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      price: 0,
      category: "Hải Sản",
      imageUrl: "",
      isHot: false
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: parseFloat(item.price),
      category: item.category,
      imageUrl: item.imageUrl,
      isHot: item.isHot
    });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.price <= 0) {
      showToast("Tên món và giá phải hợp lệ!", "error");
      return;
    }

    try {
      const payload = {
        name: formData.name,
        price: formData.price.toString(), // DB lưu dạng string trong SQLite để tránh lỗi locale
        category: formData.category,
        imageUrl: formData.imageUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
        isHot: formData.isHot
      };

      if (editingItem) {
        await api.editMenuItem(editingItem.id, payload);
        showToast("Đã cập nhật món ăn thành công!");
      } else {
        await api.addMenuItem(payload);
        showToast("Đã thêm món ăn mới!");
      }
      setShowFormModal(false);
      loadMenu();
      loadStats();
    } catch (err) {
      showToast("Thao tác thất bại. Vui lòng kiểm tra lại!", "error");
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa món "${name}" khỏi thực đơn?`)) {
      try {
        await api.deleteMenuItem(id);
        showToast("Đã xóa món ăn khỏi thực đơn!");
        loadMenu();
        loadStats();
      } catch (err) {
        showToast("Lỗi xóa món ăn!", "error");
      }
    }
  };

  const avgOrderValue = stats.totalInvoices > 0 ? (stats.totalRevenue / stats.totalInvoices) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '80vh' }}>
      
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
        <button
          className="glass-button"
          onClick={() => setActiveSubTab("menu")}
          style={{ borderColor: activeSubTab === 'menu' ? 'var(--primary-color)' : '' }}
        >
          📂 Quản Lý Thực Đơn
        </button>
        <button
          className="glass-button"
          onClick={() => setActiveSubTab("stats")}
          style={{ borderColor: activeSubTab === 'stats' ? 'var(--success-color)' : '' }}
        >
          📈 Thống Kê Doanh Thu
        </button>
        <button
          className="glass-button"
          onClick={() => { setActiveSubTab("cancelled"); loadCancelledOrders(); }}
          style={{ borderColor: activeSubTab === 'cancelled' ? 'var(--danger-color)' : '' }}
        >
          🚨 Nhật Ký Hủy Món
        </button>
        <button
          className="glass-button"
          onClick={() => { setActiveSubTab("tables"); loadTables(); }}
          style={{ borderColor: activeSubTab === 'tables' ? 'var(--primary-color)' : '' }}
        >
          🏠 Quản Lý Bàn & Phòng
        </button>
      </div>

      {/* SUB-TAB 1: QUẢN LÝ THỰC ĐƠN */}
      {activeSubTab === "menu" && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Thực Đơn Nhà Hàng ({menuItems.length} món)</h3>
            <button className="glass-button btn-success" onClick={handleOpenAddModal}>
              ➕ Thêm Món Ăn Mới
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Hình</th>
                  <th style={{ padding: '12px' }}>Tên Món</th>
                  <th style={{ padding: '12px' }}>Danh Mục</th>
                  <th style={{ padding: '12px' }}>Đặc Điểm</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Giá Bán</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '12px' }}>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }}
                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80'; }}
                      />
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {item.isHot && <span className="hot-badge" style={{ fontSize: '0.7rem' }}>🔥 Hot</span>}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--success-color)', textAlign: 'right' }}>
                      {parseFloat(item.price).toLocaleString()} đ
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          className="glass-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEditModal(item)}
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          className="glass-button btn-danger"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleDeleteItem(item.id, item.name)}
                        >
                          🗑 Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: THỐNG KÊ DOANH THU */}
      {activeSubTab === "stats" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Hộp chỉ số KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>💰 Tổng Doanh Thu</span>
              <strong style={{ fontSize: '1.8rem', color: '#fbbf24' }}>
                {stats.totalRevenue.toLocaleString()} đ
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--success-color)' }}>↑ 100% hoạt động trực tuyến</span>
            </div>
            
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🧾 Tổng Số Hóa Đơn</span>
              <strong style={{ fontSize: '1.8rem', color: 'var(--primary-color)' }}>
                {stats.totalInvoices} đơn
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hóa đơn thanh toán thành công</span>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📈 Trung Bình Hóa Đơn</span>
              <strong style={{ fontSize: '1.8rem', color: 'var(--success-color)' }}>
                {Math.round(avgOrderValue).toLocaleString()} đ
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tổng doanh thu / Tổng đơn</span>
            </div>
          </div>

          {/* Biểu đồ SVG bán chạy nhất & Danh sách */}
          <div style={{ display: 'flex', gap: '2rem' }}>
            
            {/* SVG Bar Chart */}
            <div className="glass-panel" style={{ flex: 1.5, padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>🔥 5 Món Ăn Bán Chạy Nhất</h3>
              
              {stats.bestSellers.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>Chưa có đủ số liệu giao dịch để lập biểu đồ bán chạy.</p>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <svg viewBox="0 0 500 240" style={{ width: '100%', height: '100%' }}>
                    {/* Vẽ trục đứng */}
                    <line x1="120" y1="10" x2="120" y2="210" stroke="var(--glass-border)" strokeWidth="1" />
                    {/* Vẽ trục ngang */}
                    <line x1="120" y1="210" x2="480" y2="210" stroke="var(--glass-border)" strokeWidth="1" />
                    
                    {stats.bestSellers.map((item, idx) => {
                      const maxQty = Math.max(...stats.bestSellers.map(b => b.quantity));
                      const barWidth = maxQty > 0 ? (item.quantity / maxQty) * 300 : 0;
                      const yPos = 20 + idx * 40;
                      
                      return (
                        <g key={idx}>
                          {/* Tên món */}
                          <text
                            x="110"
                            y={yPos + 15}
                            fill="var(--text-secondary)"
                            fontSize="10"
                            textAnchor="end"
                            fontWeight="600"
                          >
                            {item.name}
                          </text>

                          {/* Cột Bar Chart */}
                          <rect
                            x="120"
                            y={yPos}
                            width={barWidth}
                            height="20"
                            rx="4"
                            fill="url(#barGradient)"
                            style={{ transition: 'width 1s ease-in-out' }}
                          />

                          {/* Số lượng */}
                          <text
                            x={130 + barWidth}
                            y={yPos + 15}
                            fill="var(--text-primary)"
                            fontSize="10"
                            fontWeight="700"
                          >
                            {item.quantity} phần
                          </text>
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--primary-color)" />
                        <stop offset="100%" stopColor="var(--success-color)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}
            </div>

            {/* Danh sách món bán chạy */}
            <div className="glass-panel" style={{ flex: 1, padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Bảng Điểm Bán Chạy</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.bestSellers.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{
                        background: idx === 0 ? '#fbbf24' : idx === 1 ? '#d1d5db' : idx === 2 ? '#b45309' : 'rgba(255,255,255,0.06)',
                        color: idx <= 2 ? '#111827' : 'var(--text-primary)',
                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.8rem'
                      }}>
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--success-color)', fontWeight: 600 }}>{item.quantity} phần</span>
                  </div>
                ))}
                {stats.bestSellers.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>Không có dữ liệu</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 3: NHẬT KÝ HỦY MÓN */}
      {activeSubTab === "cancelled" && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>🚨 Nhật Ký Hủy Món (Security Audit Log)</h3>
            <button className="glass-button" onClick={loadCancelledOrders}>
              🔄 Làm mới
            </button>
          </div>

          {cancelledOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
              Chưa có lịch sử hủy món nào được ghi nhận. Hệ thống đang bảo mật tốt!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Thời Gian</th>
                    <th style={{ padding: '12px' }}>Bàn</th>
                    <th style={{ padding: '12px' }}>Tên Món Hủy</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Số Lượng</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Đơn Giá</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Hoàn Tiền</th>
                    <th style={{ padding: '12px' }}>Lý Do Hủy Món</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledOrders.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {new Date(item.cancelledAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{item.tableName}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#f87171' }}>{item.itemName}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {item.price.toLocaleString()} đ
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                        {(item.quantity * item.price).toLocaleString()} đ
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {item.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: QUẢN LÝ BÀN & PHÒNG */}
      {activeSubTab === "tables" && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Sơ Đồ Bàn Ăn & Phòng VIP ({tables.length} bàn)</h3>
            <button className="glass-button btn-success" onClick={handleOpenAddTableModal}>
              ➕ Thêm Bàn / Phòng Mới
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Tên Bàn / Phòng</th>
                  <th style={{ padding: '12px' }}>Loại</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Phí Dịch Vụ VIP</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Trạng Trạng Thái</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {tables.map(table => (
                  <tr key={table.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{table.name}</td>
                    <td style={{ padding: '12px' }}>
                      {table.type === 'VIP' ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                          💎 VIP
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          Standard
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#fbbf24', textAlign: 'right' }}>
                      {table.serviceCharge > 0 ? `${table.serviceCharge.toLocaleString()} đ` : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {table.isOccupied ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Có khách
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Trống
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          className="glass-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                          onClick={() => handleOpenEditTableModal(table)}
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          className="glass-button btn-danger"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                          onClick={() => handleDeleteTable(table.id, table.name)}
                        >
                          🗑 Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM MODAL THÊM / SỬA MÓN ĂN */}
      {showFormModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>
              {editingItem ? "✏️ Chỉnh Sửa Món Ăn" : "➕ Thêm Món Ăn Mới"}
            </h3>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Tên món */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tên món ăn:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                  placeholder="Ví dụ: Lẩu cá giòn"
                  required
                />
              </div>

              {/* Giá bán */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Giá bán (đ):</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                  required
                />
              </div>

              {/* Danh mục */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Danh mục:</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                >
                  <option value="Hải Sản">Hải Sản</option>
                  <option value="Lẩu">Lẩu</option>
                  <option value="Đồ Nướng">Đồ Nướng</option>
                  <option value="Đồ Uống">Đồ Uống</option>
                </select>
              </div>

              {/* URL Ảnh */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Link ảnh món ăn:</label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                  placeholder="Nhập URL hình ảnh..."
                />
              </div>

              {/* Món Hot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <input
                  type="checkbox"
                  id="isHot"
                  checked={formData.isHot}
                  onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isHot" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>🔥 Đánh dấu là Món Hot nổi bật</label>
              </div>

              {/* Thao tác form */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="submit" className="glass-button btn-success" style={{ flex: 1, padding: '12px' }}>
                  Lưu Lại
                </button>
                <button type="button" className="glass-button" style={{ flex: 1, padding: '12px' }} onClick={() => setShowFormModal(false)}>
                  Hủy bỏ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* FORM MODAL THÊM / SỬA BÀN ĂN */}
      {showTableModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              {editingTable ? "✏️ Chỉnh Sửa Bàn / Phòng" : "🏠 Thêm Bàn / Phòng Mới"}
            </h3>

            <form onSubmit={handleTableFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Tên bàn */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tên bàn / số phòng:</label>
                <input
                  type="text"
                  value={tableFormData.name}
                  onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                  placeholder="Ví dụ: Bàn 5, Phòng VIP 3"
                  required
                />
              </div>

              {/* Loại bàn */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loại bàn:</label>
                <select
                  value={tableFormData.type}
                  onChange={(e) => setTableFormData({ ...tableFormData, type: e.target.value, serviceCharge: e.target.value === 'Standard' ? 0 : tableFormData.serviceCharge })}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                >
                  <option value="Standard">Standard (Bàn Thường)</option>
                  <option value="VIP">💎 VIP (Phòng VIP / Bàn VIP)</option>
                </select>
              </div>

              {/* Phí dịch vụ */}
              {tableFormData.type === 'VIP' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Phí dịch vụ phòng VIP (đ):</label>
                  <input
                    type="number"
                    value={tableFormData.serviceCharge}
                    onChange={(e) => setTableFormData({ ...tableFormData, serviceCharge: parseFloat(e.target.value) || 0 })}
                    style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', outline: 'none' }}
                    min="0"
                    required
                  />
                </div>
              )}

              {/* Thao tác */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="submit" className="glass-button btn-success" style={{ flex: 1, padding: '12px', cursor: 'pointer' }}>
                  Lưu Lại
                </button>
                <button type="button" className="glass-button" style={{ flex: 1, padding: '12px', cursor: 'pointer' }} onClick={() => setShowTableModal(false)}>
                  Hủy Bỏ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
