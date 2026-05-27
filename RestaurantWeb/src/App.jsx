import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { signalRService } from './services/api';
import TableDashboard from './components/TableDashboard';
import MenuOrder from './components/MenuOrder';
import KitchenDashboard from './components/KitchenDashboard';
import CustomerOrder from './pages/CustomerOrder';
import CashierDashboard from './components/CashierDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import Login from './components/Login';

function StaffApp() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    return (token && username && role) ? { username, role } : null;
  });

  const [currentView, setCurrentView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [carts, setCarts] = useState(() => JSON.parse(localStorage.getItem('carts') || '{}'));
  const [tickets, setTickets] = useState(() => JSON.parse(localStorage.getItem('tickets') || '[]'));

  // Default view based on role
  useEffect(() => {
    if (user) {
      if (user.role === 'Kitchen') {
        setCurrentView('kitchen');
      } else {
        setCurrentView('tables');
      }
    }
  }, [user]);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setUser(null);
    showToast("Đã đăng xuất an toàn!", "info");
  };

  const navigateToMenu = (table) => {
    setSelectedTable(table);
    setCurrentView('menu');
  };

  return (
    <div className="container">
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px',
          background: toast.type === 'success' ? 'var(--success-color)' : toast.type === 'info' ? 'var(--primary-color)' : 'var(--danger-color)',
          color: 'white', padding: '12px 24px', borderRadius: '8px',
          boxShadow: 'var(--glass-shadow)', zIndex: 9999,
          animation: 'slideUp 0.3s ease-out forwards', fontWeight: '600'
        }}>
          {toast.message}
        </div>
      )}

      {!user ? (
        <Login onLoginSuccess={setUser} showToast={showToast} />
      ) : (
        <>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
            <h1 className="text-gradient animate-slide-up" style={{ fontSize: '2rem' }}>
              Restaurant Pro
            </h1>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.85rem',
                background: 'rgba(255,255,255,0.06)',
                padding: '8px 14px',
                borderRadius: '20px',
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border)'
              }}>
                👤 {user.username} ({user.role === 'Admin' ? 'Quản lý' : user.role === 'Cashier' ? 'Thu ngân' : 'Nhà bếp'})
              </span>

              {user.role !== 'Kitchen' && (
                <button
                  className="glass-button"
                  onClick={() => setCurrentView('tables')}
                  style={{ borderColor: currentView === 'tables' ? 'var(--primary-color)' : '' }}
                >
                  🏠 Bàn Ăn
                </button>
              )}
              
              <button
                className="glass-button"
                onClick={() => setCurrentView('kitchen')}
                style={{ borderColor: currentView === 'kitchen' ? 'var(--danger-color)' : '' }}
              >
                👨‍🍳 Bếp
              </button>
              
              {user.role !== 'Kitchen' && (
                <button
                  className="glass-button"
                  onClick={() => setCurrentView('cashier')}
                  style={{ borderColor: currentView === 'cashier' ? 'var(--primary-color)' : '' }}
                >
                  💰 Thu Ngân
                </button>
              )}

              {user.role === 'Admin' && (
                <button
                  className="glass-button"
                  onClick={() => setCurrentView('manager')}
                  style={{ borderColor: currentView === 'manager' ? 'var(--success-color)' : '' }}
                >
                  ⚙️ Quản Trị
                </button>
              )}

              <button
                className="glass-button btn-danger"
                onClick={handleLogout}
                style={{ padding: '8px 12px' }}
                title="Đăng xuất"
              >
                🚪 Đăng Xuất
              </button>
            </div>
          </header>

          <main className="animate-slide-up">
            {currentView === 'tables' && user.role !== 'Kitchen' && <TableDashboard onSelectTable={navigateToMenu} />}
            {currentView === 'menu' && user.role !== 'Kitchen' && (
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
            {currentView === 'cashier' && user.role !== 'Kitchen' && (
              <CashierDashboard
                showToast={showToast}
              />
            )}
            {currentView === 'manager' && user.role === 'Admin' && (
              <ManagerDashboard
                showToast={showToast}
              />
            )}
          </main>
        </>
      )}
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
