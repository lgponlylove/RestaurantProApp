import React from 'react';
import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';

const playPendingNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, duration, delay) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    };
    
    // Âm thanh báo hiệu Ding-Dong-Ding cực hay
    playTone(523.25, 0.3, 0);       // C5
    playTone(659.25, 0.3, 0.15);    // E5
    playTone(783.99, 0.5, 0.30);    // G5
  } catch (e) {
    console.error("Lỗi phát âm thanh báo hiệu:", e);
  }
};

const triggerDesktopNotification = (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
};

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
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinCallback, setPinCallback] = useState(null);
  const [pinModalTitle, setPinModalTitle] = useState("");

  const [showItemSelectModal, setShowItemSelectModal] = useState(false);
  const [itemsToSelect, setItemsToSelect] = useState([]);
  const [selectItemCallback, setSelectItemCallback] = useState(null);

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonValue, setReasonValue] = useState("");
  const [reasonCallback, setReasonCallback] = useState(null);

  const requestPin = (title, onConfirm) => {
    setPinModalTitle(title);
    setPinValue("");
    setPinCallback(() => onConfirm);
    setShowPinModal(true);
  };

  useEffect(() => {
    loadData();

    // Xin quyền thông báo đẩy trình duyệt khi mở trang
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Lắng nghe SignalR để cập nhật tức thời khi khách/nhân viên đặt món hoặc thanh toán
    signalRService.startConnection();
    
    const handleNewOrder = () => loadData();
    const handleCheckout = () => {
      loadData();
      setSelectedTable(null);
    };

    const handlePendingOrder = (tableId, orderDetails, ticketId, totalAmount, orderId) => {
      loadData();
      
      // Phát âm thanh và thông báo
      playPendingNotificationSound();
      showToast(`🔔 Có yêu cầu gọi món mới chờ duyệt tại Bàn ${tableId}!`, "warning");
      triggerDesktopNotification(
        "🛎️ Yêu Cầu Gọi Món Mới Chờ Duyệt",
        `Bàn số ${tableId} vừa gửi đơn gọi món mới và đang chờ bạn duyệt duyệt qua bếp!`
      );
    };

    const handleCheckoutRequest = ({ tableId, tableName }) => {
      api.getTables().then(updatedTables => {
        setTables(updatedTables);
        const targetTable = updatedTables.find(t => t.id === tableId);
        if (targetTable) {
          // Tự động chuyển tab sang billing và chọn bàn ăn
          setActiveTab("billing");
          setSelectedTable(targetTable);
          setPaymentMethod("Chuyển khoản"); // mặc định mở VietQR động
        }
      });

      playPendingNotificationSound();
      showToast(`💵 ${tableName} vừa yêu cầu THANH TOÁN!`, "success");
      triggerDesktopNotification(
        `🛎️ Yêu Cầu Thanh Toán - ${tableName}`,
        `Khách hàng tại ${tableName} vừa yêu cầu thanh toán hóa đơn. Đang mở hóa đơn chi tiết!`
      );
    };

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("ReceivePendingOrder", handlePendingOrder);
    signalRService.on("ReceiveCheckoutRequest", handleCheckoutRequest);
    signalRService.on("TableCheckedOut", handleCheckout);

    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("ReceivePendingOrder", handlePendingOrder);
      signalRService.off("ReceiveCheckoutRequest", handleCheckoutRequest);
      signalRService.off("TableCheckedOut", handleCheckout);

    };
  }, []);


  const loadData = () => {
    api.getTables().then(setTables);
    api.getActiveOrders().then(setActiveOrders);
    api.getInvoices().then(setInvoices);
  };

  const occupiedTables = tables.filter(t => t.isOccupied);

  // Lấy danh sách các đơn hàng chưa thanh toán của bàn được chọn (Đã được duyệt)
  const getTableOrders = (tableId) => {
    return activeOrders.filter(o => o.tableId === tableId && o.isApproved);
  };

  // Lấy danh sách các đơn hàng chưa thanh toán của bàn được chọn (Chưa được duyệt)
  const getPendingTableOrders = (tableId) => {
    return activeOrders.filter(o => o.tableId === tableId && !o.isApproved);
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

  const handleApproveOrder = async (orderId) => {
    try {
      await api.approveOrder(orderId);
      showToast("Đã phê duyệt đơn đặt món thành công! Đã chuyển xuống Bếp.");
      loadData();
    } catch (err) {
      showToast("Lỗi khi phê duyệt đơn hàng!", "error");
    }
  };

  const handleTransferTable = async (targetTableId) => {
    if (!selectedTable) return;
    try {
      const res = await api.transferTable(selectedTable.id, targetTableId);
      showToast(res.message || "Đã chuyển/gộp bàn thành công!");
      
      // Cập nhật bàn hoạt động sang bàn mới để kiểm tra hóa đơn lập tức
      const targetTable = tables.find(t => t.id === targetTableId);
      setSelectedTable(targetTable || null);
      
      setShowTransferModal(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Lỗi khi chuyển/gộp bàn!", "error");
    }
  };

  const handleCancelOrder = async (orderId, orderDetails) => {
    // Phân tách chuỗi orderDetails thành mảng các món ăn
    // Ví dụ: "2x Mực Hấp, 1x Bia" -> ["2x Mực Hấp", "1x Bia"]
    const items = orderDetails.split(',').map(s => s.trim()).filter(Boolean);
    
    if (items.length <= 1) {
      // Nếu chỉ có 1 món duy nhất trong đơn hàng, tiến hành hủy toàn bộ đơn hàng
      requestPin(`Bạn có chắc chắn muốn hủy món "${orderDetails}"? Nhập mã PIN Quản lý:`, async (pin) => {
        if (pin === "1234") {
          try {
            await api.deleteOrder(orderId);
            showToast("Đã hủy món ăn thành công!");
            loadData();
          } catch (err) {
            showToast("Lỗi hủy món ăn!", "error");
          }
        } else {
          showToast("Sai mã PIN Quản lý!", "error");
        }
      });
      return;
    }

    // Nếu có nhiều món, hiển thị custom modal để chọn món hủy lẻ trực quan
    setItemsToSelect(items);
    setSelectItemCallback(() => async (choiceIdx) => {
      const itemToCancel = items[choiceIdx];
      
      // Nhập mã PIN Quản lý để phê duyệt hủy món lẻ qua custom modal
      requestPin(`Xác nhận HỦY món "${itemToCancel}"? Nhập mã PIN Quản lý:`, async (pin) => {
        if (pin !== "1234") {
          showToast("Sai mã PIN Quản lý!", "error");
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

          // Mở custom modal để nhập lý do hủy món thay thế cho window.prompt
          setReasonValue("Khách đổi ý / Đổi món");
          setReasonCallback(() => async (reason) => {
            try {
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
          });
          setShowReasonModal(true);

        } catch (err) {
          showToast("Lỗi xử lý hủy món lẻ!", "error");
          console.error(err);
        }
      });
    });
    setShowItemSelectModal(true);
  };

  const handleCancelSingleItem = async (orderId, orderDetails, choiceIdx, itemName, qty) => {
    const items = orderDetails.split(',').map(s => s.trim()).filter(Boolean);
    
    // Nhập mã PIN Quản lý để phê duyệt hủy món lẻ qua custom modal
    requestPin(`Xác nhận HỦY 1 phần món "${itemName}"? Nhập mã PIN Quản lý:`, async (pin) => {
      if (pin !== "1234") {
        showToast("Sai mã PIN Quản lý!", "error");
        return;
      }

      try {
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

        // Nếu là món cuối cùng của đơn hàng
        if (updatedItems.length === 0) {
          setReasonValue("Khách hủy toàn bộ");
          setReasonCallback(() => async (reason) => {
            try {
              await api.deleteOrder(orderId);
              showToast("Đã hủy đơn hàng thành công!");
              loadData();
            } catch (err) {
              showToast("Lỗi hủy đơn hàng!", "error");
            }
          });
          setShowReasonModal(true);
          return;
        }

        // Cập nhật lại hóa đơn với lý do hủy
        setReasonValue("Khách đổi ý / Đổi món");
        setReasonCallback(() => async (reason) => {
          try {
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
        });
        setShowReasonModal(true);

      } catch (err) {
        showToast("Lỗi xử lý hủy món lẻ!", "error");
        console.error(err);
      }
    });
  };

  // Xác nhận thanh toán
  const handleCheckout = async (table) => {
    const total = getTableTotal(table.id);
    const serviceCharge = table.type === 'VIP' ? (table.serviceCharge || 0) : 0;
    const finalTotal = (total + serviceCharge) * (1 - discount / 100);
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
          serviceCharge: serviceCharge,
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
                      className={`glass-panel ${getPendingTableOrders(table.id).length > 0 ? 'pulse-pending' : ''}`}
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
                        {getPendingTableOrders(table.id).length > 0 ? (
                          <span style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', color: 'white', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            ⏳ Chờ Duyệt
                          </span>
                        ) : (
                          <span style={{ background: 'var(--danger-color)', color: 'white', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                            Chờ thanh toán
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Món đã gọi:
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getTableOrders(table.id).map(o => o.orderDetails).join(', ') || 
                           (getPendingTableOrders(table.id).length > 0 ? 
                            `📝 Chờ duyệt: ${getPendingTableOrders(table.id).map(o => o.orderDetails).join(', ')}` : 
                            'Chưa gọi món'
                           )}
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

                {/* Danh sách các đơn hàng chờ duyệt từ khách hàng quét QR */}
                {getPendingTableOrders(selectedTable.id).length > 0 && (
                  <div style={{
                    background: 'rgba(251, 191, 36, 0.08)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 15px',
                    marginBottom: '1.25rem',
                    animation: 'slideUp 0.3s ease-out'
                  }}>
                    <h4 style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⏳ Yêu Cầu Gọi Món Trực Tuyến Chờ Duyệt
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getPendingTableOrders(selectedTable.id).map(order => (
                        <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{order.orderDetails}</span>
                          <button
                            className="glass-button btn-success"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, height: '26px' }}
                            onClick={() => handleApproveOrder(order.id)}
                          >
                            ⚡ Duyệt
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                 {/* Danh sách món ăn chi tiết lẻ từng sản phẩm */}
                <div style={{ maxHeight: '35vh', overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getTableOrders(selectedTable.id).flatMap((order) => {
                    const items = order.orderDetails.split(',').map(s => s.trim()).filter(Boolean);
                    return items.map((item, itemIdx) => {
                      return {
                        orderId: order.id,
                        fullDetails: order.orderDetails,
                        itemText: item,
                        itemIdx: itemIdx,
                        createdAt: order.createdAt
                      };
                    });
                  }).map((parsedItem, idx) => {
                    const match = parsedItem.itemText.match(/^(\d+)x\s+(.+)$/);
                    const qty = match ? parseInt(match[1]) : 1;
                    const itemName = match ? match[2].trim() : parsedItem.itemText;

                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dotted var(--glass-border)', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            <span style={{ color: '#fbbf24', marginRight: '6px' }}>{qty}x</span>
                            {itemName}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(parsedItem.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            className="glass-button btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '6px', height: '26px', cursor: 'pointer' }}
                            onClick={() => handleCancelSingleItem(parsedItem.orderId, parsedItem.fullDetails, parsedItem.itemIdx, itemName, qty)}
                            title="Hủy món này"
                          >
                            🗑 Hủy
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Form Tính Tiền */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  
                  {/* Tổng tiền gốc */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tạm tính:</span>
                    <span>{getTableTotal(selectedTable.id).toLocaleString()} đ</span>
                  </div>

                  {/* Phí dịch vụ VIP */}
                  {selectedTable.type === 'VIP' && (selectedTable.serviceCharge || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 600 }}>
                      <span>Phí dịch vụ VIP (💎):</span>
                      <span>+{(selectedTable.serviceCharge || 0).toLocaleString()} đ</span>
                    </div>
                  )}

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
                      {((getTableTotal(selectedTable.id) + (selectedTable.type === 'VIP' ? (selectedTable.serviceCharge || 0) : 0)) * (1 - discount / 100)).toLocaleString()} đ
                    </strong>
                  </div>
                </div>

                {/* Giao diện hiển thị VietQR Động miễn phí khi chọn Chuyển khoản */}
                {paymentMethod === "Chuyển khoản" && (
                  <div style={{
                    marginTop: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '12px 15px',
                    textAlign: 'center',
                    animation: 'slideUp 0.3s ease-out'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, marginBottom: '8px' }}>
                      💵 Quét VietQR Thanh Toán Động (Miễn phí)
                    </div>
                    <img 
                      src={`https://img.vietqr.io/image/MB-123456789-qr_only.png?amount=${Math.round((getTableTotal(selectedTable.id) + (selectedTable.type === 'VIP' ? (selectedTable.serviceCharge || 0) : 0)) * (1 - discount / 100))}&addInfo=Ban%20${selectedTable.name.replace(/\s+/g, '')}%20Thanh%20Toan&accountName=NHA%20HANG%20RESTAURANT%20PRO`}
                      alt="VietQR Payment"
                      style={{ width: '130px', height: '130px', margin: '0 auto', display: 'block', background: '#fff', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                      Ngân hàng: <strong>MB Bank</strong><br />
                      Số TK: <strong>123456789</strong> | Tên TK: <strong>RESTAURANT PRO</strong>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexDirection: 'column' }}>
                  <button
                    className="glass-button"
                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem', fontWeight: 700, borderColor: '#fbbf24', color: '#fbbf24' }}
                    onClick={() => setShowTransferModal(true)}
                  >
                    🔄 Chuyển / Gộp Bàn
                  </button>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
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
                      Đóng
                    </button>
                  </div>
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
              {currentReceipt.serviceCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phí dịch vụ VIP:</span>
                  <span>+{currentReceipt.serviceCharge.toLocaleString()} đ</span>
                </div>
              )}
              {currentReceipt.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Giảm giá ({currentReceipt.discount}%):</span>
                  <span>-{((currentReceipt.totalAmount + currentReceipt.serviceCharge) * currentReceipt.discount / 100).toLocaleString()} đ</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', marginTop: '6px' }}>
                <span>TONG CONG:</span>
                <span>{currentReceipt.finalAmount.toLocaleString()} đ</span>
              </div>
            </div>

            {currentReceipt.paymentMethod === "Chuyển khoản" && (
              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #111827', paddingTop: '15px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>QUÉT MÃ CHUYỂN KHOẢN</div>
                <img 
                  src={`https://img.vietqr.io/image/MB-123456789-print.png?amount=${Math.round(currentReceipt.finalAmount)}&addInfo=Ban%20${currentReceipt.tableName.replace(/\s+/g, '')}%20Thanh%20Toan&accountName=RESTAURANT%20PRO`}
                  alt="VietQR"
                  style={{ width: '120px', height: '120px', margin: '0 auto', display: 'block', border: '1px solid #ddd', padding: '4px', background: '#fff' }}
                />
                <div style={{ fontSize: '0.65rem', color: '#333', marginTop: '6px', lineHeight: 1.3 }}>
                  Ngân hàng: MB Bank<br />
                  Số TK: 123456789 | Tên TK: RESTAURANT PRO
                </div>
              </div>
            )}

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

      {/* Pop-up Nhập PIN Bảo Mật Cực Đẹp */}
      {showPinModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Xác Thực Quản Lý</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{pinModalTitle}</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              setShowPinModal(false);
              if (pinCallback) pinCallback(pinValue);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="password"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="••••"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '2rem',
                  letterSpacing: '0.5rem',
                  textAlign: 'center',
                  outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                }}
                autoFocus
                required
              />
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="submit" className="glass-button btn-success" style={{ flex: 1, padding: '10px' }}>
                  Xác Nhận
                </button>
                <button type="button" className="glass-button" style={{ flex: 1, padding: '10px' }} onClick={() => setShowPinModal(false)}>
                  Hủy Bỏ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chọn Món Để Hủy Lẻ Trực Quan */}
      {showItemSelectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 800 }}>
              📝 Chọn Món Muốn Hủy Lẻ
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Đơn hàng này có nhiều món. Vui lòng bấm vào món ăn cần giảm số lượng hoặc hủy bỏ:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem', maxHeight: '40vh', overflowY: 'auto' }}>
              {itemsToSelect.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowItemSelectModal(false);
                    if (selectItemCallback) selectItemCallback(idx);
                  }}
                  className="glass-button table-row-hover"
                  style={{
                    width: '100%',
                    padding: '14px',
                    textAlign: 'left',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span>{item}</span>
                  <span style={{ color: 'var(--danger-color)', fontSize: '0.8rem', fontWeight: 700 }}>🗑 Hủy / Giảm</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowItemSelectModal(false)}
              className="glass-button"
              style={{ width: '100%', padding: '12px', cursor: 'pointer' }}
            >
              Hủy Thao Tác
            </button>
          </div>
        </div>
      )}

      {/* Modal Nhập Lý Do Hủy Món */}
      {showReasonModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 800 }}>
              ✏️ Lý Do Hủy Món
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              setShowReasonModal(false);
              if (reasonCallback) reasonCallback(reasonValue);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nhập lý do hủy món:</label>
                <input
                  type="text"
                  value={reasonValue}
                  onChange={(e) => setReasonValue(e.target.value)}
                  placeholder="Ví dụ: Khách đổi ý..."
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  autoFocus
                  required
                />
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {["Khách đổi ý / Đổi món", "Hết nguyên liệu", "Chờ lâu nên hủy", "Nhân viên bấm nhầm"].map((suggest, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setReasonValue(suggest)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '15px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {suggest}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="submit" className="glass-button btn-success" style={{ flex: 1, padding: '10px', cursor: 'pointer' }}>
                  Xác Nhận
                </button>
                <button type="button" className="glass-button" style={{ flex: 1, padding: '10px', cursor: 'pointer' }} onClick={() => setShowReasonModal(false)}>
                  Hủy Bỏ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chuyển / Gộp Bàn */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 800 }}>
              🔄 Chuyển / Gộp Bàn Ăn
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Di chuyển hóa đơn của <strong>{selectedTable?.name}</strong> sang bàn khác.
            </p>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
              {tables.filter(t => t.id !== selectedTable?.id).map((t) => {
                const targetOrders = activeOrders.filter(o => o.tableId === t.id && o.isApproved);
                const isTargetOccupied = t.isOccupied || targetOrders.length > 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTransferTable(t.id)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      padding: '12px 15px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{t.name}</strong>
                      {t.type === 'VIP' && <span style={{ fontSize: '0.7rem', color: '#f87171', marginLeft: '6px', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>💎 VIP</span>}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isTargetOccupied ? '#f87171' : 'var(--success-color)' }}>
                      {isTargetOccupied ? '🔴 Gộp Hóa Đơn' : '🟢 Chuyển Sang'}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="glass-button"
              style={{ width: '100%', padding: '12px', fontWeight: 700 }}
              onClick={() => setShowTransferModal(false)}
            >
              ✕ Đóng Cửa Sổ
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
