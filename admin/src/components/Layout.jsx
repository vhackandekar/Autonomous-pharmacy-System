import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ children }) {
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    // Global Stock Alert Listener
    socket.on('stock_alert', (notification) => {
      toast.error(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 700 }}>Inventory Warning</span>
            <span style={{ fontSize: 13 }}>{notification.message}</span>
          </div>
        ),
        { duration: 6000, id: 'stock-alert-' + notification._id }
      );
    });

    // Global Refill Alert Listener
    socket.on('refill_alert_admin', (notification) => {
      toast.custom((t) => (
        <div className={`notification-toast ${t.visible ? 'active' : ''}`}
          style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--accent-orange)',
            padding: '12px 18px',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
          <span style={{ fontWeight: 800, color: 'var(--accent-orange)', fontSize: 12 }}>PROACTIVE REFILL NEEDED</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{notification.message}</span>
        </div>
      ), { duration: 5000, id: 'refill-alert-' + notification._id });
    });

    return () => {
      socket.off('stock_alert');
      socket.off('refill_alert_admin');
      socket.disconnect();
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-content page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
