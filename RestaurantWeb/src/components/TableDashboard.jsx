import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';
import QRCodeDisplay from './QRCodeDisplay';

export default function TableDashboard({ onSelectTable }) {
  const [tables, setTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [qrTable, setQrTable] = useState(null);

  const loadData = () => {
    api.getTables().then(setTables);
    api.getActiveOrders().then(setActiveOrders).catch(() => {});
  };

  useEffect(() => {
    loadData();

    const handleNewOrder = () => loadData();
    const handleCheckout = () => loadData();
    const handlePending = () => loadData();

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("ReceivePendingOrder", handlePending);
    signalRService.on("TableCheckedOut", handleCheckout);

    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("ReceivePendingOrder", handlePending);
      signalRService.off("TableCheckedOut", handleCheckout);
    };
  }, []);

  return (
    <>
      <div className="grid-auto">
        {tables.map(table => {
          const tableOrders = activeOrders.filter(o => o.tableId === table.id);
          const hasPending = tableOrders.some(o => !o.isApproved);
          const isOccupied = table.isOccupied || tableOrders.length > 0;
          
          let borderCol = 'var(--success-color)';
          if (isOccupied) borderCol = 'var(--danger-color)';
          if (hasPending) borderCol = '#fbbf24'; // Màu vàng cho đơn chờ duyệt

          return (
            <div
              key={table.id}
              className={`glass-panel ${hasPending ? 'pulse-yellow' : ''}`}
              style={{
                textAlign: 'center',
                borderTop: `4px solid ${borderCol}`,
                position: 'relative',
                boxShadow: hasPending ? '0 0 15px rgba(251, 191, 36, 0.25)' : 'var(--glass-shadow)'
              }}
            >
            {/* Nút QR góc trên phải */}
            <button
              className="glass-button"
              style={{
                position: 'absolute', top: '12px', right: '12px',
                padding: '5px 10px', fontSize: '0.78rem', fontWeight: 700,
                borderColor: 'var(--primary-color)', color: 'var(--primary-color)'
              }}
              onClick={(e) => { e.stopPropagation(); setQrTable(table); }}
            >
              📱 QR
            </button>

            {/* Nội dung bàn — click để chọn */}
            <div style={{ cursor: 'pointer', paddingTop: '8px' }} onClick={() => onSelectTable(table)}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {table.name}
                {table.type === 'VIP' && (
                  <span style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 800 }}>
                    💎 VIP
                  </span>
                )}
              </h2>
              {table.type === 'VIP' && table.serviceCharge > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px', fontWeight: 700 }}>
                  Phí VIP: +{table.serviceCharge.toLocaleString()} đ
                </div>
              )}
              <span style={{
                color: hasPending ? '#fbbf24' : isOccupied ? 'var(--danger-color)' : 'var(--success-color)',
                fontWeight: '700',
                animation: hasPending ? 'pulse 1.5s infinite' : 'none'
              }}>
                {hasPending ? '🟡 Đang chờ duyệt đơn' : isOccupied ? '🔴 Đang phục vụ' : '🟢 Bàn trống'}
              </span>
            </div>
          </div>
        );
      })}
      </div>

      {/* Popup QR Code */}
      {qrTable && <QRCodeDisplay table={qrTable} onClose={() => setQrTable(null)} />}
    </>
  );
}
