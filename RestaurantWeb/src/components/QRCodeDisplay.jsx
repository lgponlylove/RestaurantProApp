import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeDisplay({ table, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/order/${table.id}?token=${table.currentSessionToken || ''}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '4px', fontSize: '1.3rem' }}>📱 QR Code</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {table.name} — Khách quét để gọi món
        </p>

        {/* QR Code */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '20px',
          display: 'inline-block', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          marginBottom: '1.25rem'
        }}>
          <QRCodeSVG
            value={url}
            size={200}
            level="H"
            includeMargin={false}
          />
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', wordBreak: 'break-all' }}>
          {url}
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="glass-button btn-primary"
            style={{ flex: 1 }}
            onClick={copyUrl}
          >
            {copied ? '✅ Đã sao chép!' : '📋 Sao chép link'}
          </button>
          <button
            className="glass-button"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            ✕ Đóng
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.5 }}>
          ⚠️ Điện thoại cần kết nối cùng Wi-Fi với máy tính
        </p>
      </div>
    </div>
  );
}
