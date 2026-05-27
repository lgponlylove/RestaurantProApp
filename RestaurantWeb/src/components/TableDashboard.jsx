import { useState, useEffect } from 'react';
import { api, signalRService } from '../services/api';
import QRCodeDisplay from './QRCodeDisplay';

export default function TableDashboard({ onSelectTable }) {
  const [tables, setTables] = useState([]);
  const [qrTable, setQrTable] = useState(null);

  useEffect(() => {
    api.getTables().then(setTables);

    const handleNewOrder = ({ tableId }) => {
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, isOccupied: true } : t));
    };

    const handleCheckout = ({ tableId }) => {
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, isOccupied: false } : t));
    };

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("TableCheckedOut", handleCheckout);

    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("TableCheckedOut", handleCheckout);
    };
  }, []);

  return (
    <>
      <div className="grid-auto">
        {tables.map(table => (
          <div
            key={table.id}
            className="glass-panel"
            style={{
              textAlign: 'center',
              borderTop: `4px solid ${table.isOccupied ? 'var(--danger-color)' : 'var(--success-color)'}`,
              position: 'relative'
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
                color: table.isOccupied ? 'var(--danger-color)' : 'var(--success-color)',
                fontWeight: '600'
              }}>
                {table.isOccupied ? '🔴 Đang phục vụ' : '🟢 Bàn trống'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Popup QR Code */}
      {qrTable && <QRCodeDisplay table={qrTable} onClose={() => setQrTable(null)} />}
    </>
  );
}
