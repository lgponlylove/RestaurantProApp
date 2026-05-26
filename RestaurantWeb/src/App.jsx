import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { signalRService } from './services/api';
import TableDashboard from './components/TableDashboard';
import MenuOrder from './components/MenuOrder';
import KitchenDashboard from './components/KitchenDashboard';
import CustomerOrder from './pages/CustomerOrder';

function StaffApp() {
  const [currentView, setCurrentView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [carts, setCarts] = useState(() => JSON.parse(localStorage.getItem('carts') || '{}'));
  const [tickets, setTickets] = useState(() => JSON.parse(localStorage.getItem('tickets') || '[]'));

  useEffect(() => {
    localStorage.setItem('carts', JSON.stringify(carts));
  }, [carts]);

  useEffect(() => {
    localStorage.setItem('tickets', JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    signalRService.startConnection();

    const handleNewOrder = ({ tableId, orderDetails, ticketId }) => {
      setTickets(prev => {
        if (prev.some(t => t.id === ticketId)) return prev;
        return [...prev, { id: ticketId, tableId, orderDetails }];
      });
    };

    const handleItemCooked = ({ ticketId, tableId }) => {
      setCarts(prev => {
        const tableCart = prev[tableId];
        if (!tableCart) return prev;
        const newCart = tableCart.map(item => item.ticketId === ticketId ? { ...item, status: 'cooked' } : item);
        return { ...prev, [tableId]: newCart };
      });
    };

    signalRService.on("ReceiveNewOrder", handleNewOrder);
    signalRService.on("ItemCooked", handleItemCooked);
    return () => {
      signalRService.off("ReceiveNewOrder", handleNewOrder);
      signalRService.off("ItemCooked", handleItemCooked);
    };
  }, []);

  const navigateToMenu = (table) => {
    setSelectedTable(table);
    setCurrentView('menu');
  };

  return (
    <div className="container">
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px',
          background: toast.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)',
          color: 'white', padding: '12px 24px', borderRadius: '8px',
          boxShadow: 'var(--glass-shadow)', zIndex: 9999,
          animation: 'slideUp 0.3s ease-out forwards', fontWeight: '600'
        }}>
          {toast.message}
        </div>
      )}
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <h1 className="text-gradient animate-slide-up" style={{ fontSize: '2rem' }}>
          Restaurant Pro
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="glass-button"
            onClick={() => setCurrentView('tables')}
            style={{ borderColor: currentView === 'tables' ? 'var(--primary-color)' : '' }}
          >
            🏠 Bàn Ăn
          </button>
          <button
            className="glass-button"
            onClick={() => setCurrentView('kitchen')}
            style={{ borderColor: currentView === 'kitchen' ? 'var(--danger-color)' : '' }}
          >
            👨‍🍳 Nhà Bếp
          </button>
        </div>
      </header>

      <main className="animate-slide-up">
        {currentView === 'tables' && <TableDashboard onSelectTable={navigateToMenu} />}
        {currentView === 'menu' && (
          <MenuOrder
            table={selectedTable}
            onBack={() => setCurrentView('tables')}
            cart={carts[selectedTable?.id] || []}
            updateCart={(newCart) => setCarts(prev => ({ ...prev, [selectedTable?.id]: newCart }))}
            clearCart={() => setCarts(prev => {
              const copy = { ...prev };
              delete copy[selectedTable?.id];
              return copy;
            })}
            showToast={showToast}
          />
        )}
        {currentView === 'kitchen' && (
          <KitchenDashboard
            tickets={tickets}
            setTickets={setTickets}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StaffApp />} />
        <Route path="/order/:tableId" element={<CustomerOrder />} />
      </Routes>
    </BrowserRouter>
  );
}
