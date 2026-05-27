import React from 'react';
import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';

export default function CashierDashboard({ showToast }) {
  const [tables, setTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Tiền mặt");
  const [discount, setDiscount] = useState(0); // phần trăm giảm giá
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [activeTab, setActiveTab] = useState("billing"); // billing hoặc history

  useEffect(() => {
    loadData();

    // Lắng nghe SignalR để cập nhật tức thời khi khách/nhân viên đặt món hoặc thanh toán
    signalRService.startConnection();
    
    const handleNewOrder = () => loadData();
    const handleCheckout = () => {
      loadData();
      setSelectedTable(null);
    };

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("TableCheckedOut", handleCheckout);

    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("TableCheckedOut", handleCheckout);
    };
  }, []);

  const loadData = () => {
    api.getTables().then(setTables);
    api.getActiveOrders().then(setActiveOrders);
    api.getInvoices().then(setInvoices);
  };

  const occupiedTables = tables.filter(t => t.isOccupied);

  // Lấy danh sách các đơn hàng chưa thanh toán của bàn được chọn
  const getTableOrders = (tableId) => {
    return activeOrders.filter(o => o.tableId === tableId);
  };

  // Tính tổng tiền tạm tính của bàn
  const getTableTotal = (tableId) => {
    return getTableOrders(tableId).reduce((sum, o) => sum + o.totalAmount, 0);
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setDiscount(0);
    setPaymentMethod("Tiền mặt");
  };

  const handleCancelOrder = async (orderId, orderDetails) => {
    // Phân tách chuỗi orderDetails thành mảng các món ăn
    // Ví dụ: "2x Mực Hấp, 1x Bia" -> ["2x Mực Hấp", "1x Bia"]
    const items = orderDetails.split(',').map(s => s.trim()).filter(Boolean);
    
    if (items.length <= 1) {
      // Nếu chỉ có 1 món duy nhất trong đơn hàng, tiến hành hủy toàn bộ đơn hàng
      const pin = window.prompt(`Bạn có chắc chắn muốn hủy món "${orderDetails}"? Vui lòng nhập mã PIN Quản lý:`);
      if (pin === "1234") {
        try {
          await api.deleteOrder(orderId);
          showToast("Đã hủy món ăn thành công!");
          loadData();
        } catch (err) {
          showToast("Lỗi hủy món ăn!", "error");
        }
      } else if (pin !== null) {
        showToast("Sai mã PIN Quản lý!", "error");
      }
      return;
    }

    // Nếu có nhiều món, chúng ta cho phép chọn món cụ thể để hủy lẻ
    let promptMsg = `Hóa đơn này có nhiều món. Vui lòng chọn số thứ tự món muốn HỦY LẺ:\n`;
    items.forEach((item, idx) => {
      promptMsg += `${idx + 1}. ${item}\n`;
    });
    promptMsg += `Nhập số thứ tự cần hủy (1-${items.length}):`;

    const choiceStr = window.prompt(promptMsg);
    if (!choiceStr) return;

    const choiceIdx = parseInt(choiceStr) - 1;
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= items.length) {
      showToast("Lựa chọn không hợp lệ!", "error");
      return;
    }

    const itemToCancel = items[choiceIdx];
    
    // Nhập mã PIN Quản lý để phê duyệt hủy món lẻ
    const pin = window.prompt(`Xác nhận HỦY món "${itemToCancel}"? Vui lòng nhập mã PIN Quản lý:`);
    if (pin !== "1234") {
      if (pin !== null) showToast("Sai mã PIN Quản lý!", "error");
      return;
    }

    // Tiến hành tính toán giảm trừ giá tiền của món đó!
    try {
      const match = itemToCancel.match(/^(\d+)x\s+(.+)$/);
      if (!match) {
        showToast("Lỗi phân tích món ăn!", "error");
        return;
      }

      const qty = parseInt(match[1]);
      const itemName = match[2].trim();

      // Tìm giá tiền của món ăn đó trong danh sách thực đơn
      const menu = await api.getMenuItems();
      const menuItem = menu.find(m => m.name.toLowerCase() === itemName.toLowerCase());
      if (!menuItem) {
        showToast("Không tìm thấy giá món ăn để hoàn tiền!", "error");
        return;
      }
      const itemPrice = parseFloat(menuItem.price);

      // Cập nhật lại danh sách món và giá tiền
      let updatedItems = [...items];
      let priceToRefund = itemPrice;

      if (qty > 1) {
        // Giảm số lượng đi 1 phần
        updatedItems[choiceIdx] = `${qty - 1}x ${itemName}`;
      } else {
        // Xóa hẳn món này ra khỏi danh sách
        updatedItems.splice(choiceIdx, 1);
      }

      const newOrderDetails = updatedItems.join(', ');
      
      // Lấy đơn hàng hiện tại
      const allActive = await api.getActiveOrders();
      const currentOrder = allActive.find(o => o.id === orderId);
      if (!currentOrder) return;

      const newTotal = currentOrder.totalAmount - priceToRefund;

      const reason = window.prompt("Nhập lý do hủy món:", "Khách đổi ý / Đổi món");
      if (reason === null) return; // User cancelled prompt

      // Gọi API cập nhật
      await api.updateOrder(orderId, {
        orderDetails: newOrderDetails,
        totalAmount: newTotal,
        cancelledItemName: itemName,
        cancelledQty: 1,
        cancelledPrice: itemPrice,
        reason: reason || "Khách hủy món lẻ"
      });

      showToast(`Đã giảm/hủy thành công 1 phần "${itemName}"!`);
      loadData();
    } catch (err) {
      showToast("Lỗi xử lý hủy món lẻ!", "error");
      console.error(err);
    }
  };

  // Xác nhận thanh toán
  const handleCheckout = async (table) => {
    const total = getTableTotal(table.id);
    const finalTotal = total * (1 - discount / 100);
    const details = getTableOrders(table.id).map(o => o.orderDetails).join("; ");

    if (window.confirm(`Xác nhận thanh toán hóa đơn ${table.name} với số tiền là ${finalTotal.toLocaleString()} đ?`)) {
      try {
        await signalRService.checkoutTable(table.id, paymentMethod);
        showToast(`Thanh toán thành công ${table.name}!`);
        // Mở hóa đơn vừa thanh toán để in
        setCurrentReceipt({
          tableName: table.name,
          orderDetails: details,
          totalAmount: total,
          discount: discount,
          finalAmount: finalTotal,
          paymentMethod: paymentMethod,
          createdAt: new Date().toISOString()
        });
        setShowReceiptModal(true);
        setSelectedTable(null);
      } catch (err) {
        showToast("Lỗi thanh toán. Vui lòng thử lại!", "error");
      }
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '80vh' }}>
      
      {/* Menu Sub-tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
        <button
          className="glass-button"
          onClick={() => setActiveTab("billing")}
          style={{ borderColor: activeTab === 'billing' ? 'var(--primary-color)' : '' }}
        >
          💰 Bàn Đang Phục Vụ
        </button>
        <button
          className="glass-button"
          onClick={() => setActiveTab("history")}
          style={{ borderColor: activeTab === 'history' ? 'var(--success-color)' : '' }}
        >
          📋 Lịch Sử Thanh Toán
        </button>
      </div>

      {activeTab === "billing" && (
        <div style={{ display: 'flex', gap: '2rem' }}>
          {/* Cột trái: Danh sách bàn đang hoạt động */}
          <div style={{ flex: 1.5 }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>Bàn Đang Có Khách ({occupiedTables.length})</h3>
            
            {occupiedTables.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍵</div>
                Chưa có bàn nào đang hoạt động. Khách quét QR gọi món sẽ tự động xuất hiện tại đây!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {occupiedTables.map(table => {
                  const total = getTableTotal(table.id);
                  const isSelected = selectedTable?.id === table.id;
                  return (
                    <div
                      key={table.id}
                      className="glass-panel"
                      onClick={() => handleSelectTable(table)}
                      style={{
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--primary-color)' : 'var(--glass-border)',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : '',
                        transition: 'all 0.3s ease',
                        boxShadow: isSelected ? '0 0 20px rgba(59,130,246,0.2)' : ''
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{table.name}</span>
                        <span style={{ background: 'var(--danger-color)', color: 'white', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          Chờ thanh toán
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Món đã gọi:
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getTableOrders(table.id).map(o => o.orderDetails).join(', ') || 'Chưa gọi món'}
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tạm tính:</span>
                        <strong style={{ color: '#fbbf24', fontSize: '1.1rem' }}>{total.toLocaleString()} đ</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cột phải: Hóa đơn chi tiết & Thanh toán */}
          <div style={{ flex: 1 }}>
            {selectedTable ? (
              <div className="glass-panel" style={{ position: 'sticky', top: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                  💳 Hóa Đơn Chi Tiết — {selectedTable.name}
                </h3>

                {/* Danh sách món ăn */}
                <div style={{ maxHeight: '35vh', overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getTableOrders(selectedTable.id).map((order, idx) => (
                    <div key={order.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dotted var(--glass-border)', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{order.orderDetails}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{order.totalAmount.toLocaleString()} đ</strong>
                        <button
                          className="glass-button btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', height: '24px' }}
                          onClick={() => handleCancelOrder(order.id, order.orderDetails)}
                          title="Hủy món ăn"
                        >
                          🗑 Hủy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Tính Tiền */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  
                  {/* Tổng tiền gốc */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tạm tính:</span>
                    <span>{getTableTotal(selectedTable.id).toLocaleString()} đ</span>
                  </div>

                  {/* Giảm giá */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Giảm giá (%):</span>
                    <select
                      value={discount}
                      onChange={(e) => setDiscount(parseInt(e.target.value))}
                      style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '4px 8px', outline: 'none' }}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="10">10%</option>
                      <option value="15">15%</option>
                      <option value="20">20%</option>
                    </select>
                  </div>

                  {/* Phương thức thanh toán */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hình thức:</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '4px 8px', outline: 'none' }}
                    >
                      <option value="Tiền mặt">💵 Tiền mặt</option>
                      <option value="Chuyển khoản">💳 Chuyển khoản</option>
                      <option value="Thẻ tín dụng">🏦 Thẻ tín dụng</option>
                    </select>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '5px 0' }} />

                  {/* Tổng tiền cuối */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Tổng cộng:</span>
                    <strong style={{ color: '#fbbf24', fontSize: '1.4rem' }}>
                      {(getTableTotal(selectedTable.id) * (1 - discount / 100)).toLocaleString()} đ
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                  <button
                    className="glass-button btn-success"
                    style={{ flex: 1, padding: '12px', fontSize: '0.95rem', fontWeight: 700 }}
                    onClick={() => handleCheckout(selectedTable)}
                  >
                    🍳 Thanh Toán & In
                  </button>
                  <button
                    className="glass-button"
                    style={{ flex: 0.5 }}
                    onClick={() => setSelectedTable(null)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👈</span>
                Chọn một bàn để hiển thị chi tiết hóa đơn và xử lý thanh toán
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Lịch sử hóa đơn */}
      {activeTab === "history" && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Lịch Sử Giao Dịch</h3>
          
          {invoices.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>Chưa có hóa đơn nào được thanh toán.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Mã HĐ</th>
                    <th style={{ padding: '12px' }}>Bàn</th>
                    <th style={{ padding: '12px' }}>Chi Tiết Món Ăn</th>
                    <th style={{ padding: '12px' }}>Hình Thức</th>
                    <th style={{ padding: '12px' }}>Thời Gian</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Tổng Tiền</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Xem Lại</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(invoice => (
                    <tr key={invoice.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>#HĐ{invoice.id}</td>
                      <td style={{ padding: '12px', fontWeight: 700 }}>{invoice.tableName}</td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {invoice.orderDetails}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {invoice.paymentMethod === 'Tiền mặt' ? '💵 Tiền mặt' : invoice.paymentMethod === 'Chuyển khoản' ? '💳 Chuyển khoản' : '🏦 Thẻ'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                        {new Date(invoice.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 800, color: 'var(--success-color)', textAlign: 'right' }}>
                        {invoice.totalAmount.toLocaleString()} đ
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          className="glass-button"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => {
                            setCurrentReceipt({
                              id: invoice.id,
                              tableName: invoice.tableName,
                              orderDetails: invoice.orderDetails,
                              totalAmount: invoice.totalAmount,
                              discount: 0,
                              finalAmount: invoice.totalAmount,
                              paymentMethod: invoice.paymentMethod,
                              createdAt: invoice.createdAt
                            });
                            setShowReceiptModal(true);
                          }}
                        >
                          👁
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pop-up Hóa Đơn Máy In Nhiệt Cực Đẹp */}
      {showReceiptModal && currentReceipt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white', color: '#111827', width: '100%', maxWidth: '340px',
            borderRadius: '4px', padding: '24px 20px', fontFamily: '"Courier New", Courier, monospace',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', position: 'relative'
          }} className="printable-receipt">
            
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px' }}>RESTAURANT PRO</h2>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>Đường 3/2, Quận 10, TP.HCM</p>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>SĐT: 0987.654.321</p>
              <div style={{ borderBottom: '1px dashed #111827', margin: '12px 0' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '5px 0' }}>PHIEU THANH TOAN</h3>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>{currentReceipt.tableName}</p>
            </div>

            <div style={{ fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '15px' }}>
              <div>Số HĐ: #HĐ{currentReceipt.id || Math.floor(Math.random() * 10000)}</div>
              <div>Ngày: {new Date(currentReceipt.createdAt).toLocaleString('vi-VN')}</div>
              <div>P.Thức: {currentReceipt.paymentMethod}</div>
              <div style={{ borderBottom: '1px dashed #111827', margin: '10px 0' }} />
            </div>

            {/* Chi tiết món ăn */}
            <div style={{ fontSize: '0.8rem', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '5px' }}>
                <span>Tên Món</span>
                <span>Thành tiền</span>
              </div>
              {currentReceipt.orderDetails.split(';').map((item, index) => {
                const cleanItem = item.trim();
                if (!cleanItem) return null;
                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{cleanItem}</span>
                  </div>
                );
              })}
              <div style={{ borderBottom: '1px dashed #111827', margin: '10px 0' }} />
            </div>

            {/* Tổng cộng */}
            <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tạm tính:</span>
                <span>{currentReceipt.totalAmount.toLocaleString()} đ</span>
              </div>
              {currentReceipt.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Giảm giá ({currentReceipt.discount}%):</span>
                  <span>-{(currentReceipt.totalAmount * currentReceipt.discount / 100).toLocaleString()} đ</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', marginTop: '6px' }}>
                <span>TONG CONG:</span>
                <span>{currentReceipt.finalAmount.toLocaleString()} đ</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '25px', fontSize: '0.75rem', fontStyle: 'italic' }}>
              Cảm ơn quý khách và hẹn gặp lại!<br />★★★
            </div>

            {/* Nút thao tác trên màn hình (Sẽ bị ẩn đi khi in thật) */}
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={printReceipt} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
                🖨 In hóa đơn
              </button>
              <button onClick={() => setShowReceiptModal(false)} style={{ flex: 1, background: '#374151', color: 'white', border: 'none', borderRadius: '4px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
