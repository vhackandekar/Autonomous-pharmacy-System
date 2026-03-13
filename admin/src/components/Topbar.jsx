import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon, Sun, ShoppingCart, AlertTriangle, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAdminNotifications, getAllOrders, getMedicines, markNotificationRead, markAllNotificationsRead } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'SA';

  useEffect(() => {
    fetchNotifications();

    // Socket: Listen for real-time notifications
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    socket.on('notification', fetchNotifications);
    socket.on('stock_alert', fetchNotifications);
    socket.on('refill_alert_admin', fetchNotifications);
    socket.on('order_created', fetchNotifications);

    // Refresh notifications every 30 seconds as fallback
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };

    if (showNotifications || showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showProfile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowProfile(false);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      try {
        const [notifsRes, ordersRes, medicinesRes] = await Promise.all([
          getAdminNotifications().catch(() => ({ data: [] })),
          getAllOrders().catch(() => ({ data: [] })),
          getMedicines().catch(() => ({ data: [] }))
        ]);

        const allNotifs = [];

        // 1. Add Real DB Notifications
        const notificationsData = notifsRes.data.notifications || (Array.isArray(notifsRes.data) ? notifsRes.data : []);
        notificationsData.forEach(notif => {
          allNotifs.push({
            id: notif._id,
            type: notif.type,
            title: notif.type === 'refill' ? 'Refill Alert' : (notif.type === 'order' ? 'Order Update' : (notif.type === 'stock_alert' ? 'Low Stock Alert' : (notif.type === 'prescription' ? 'Prescription Update' : 'System Alert'))),
            message: notif.message,
            time: new Date(notif.sentAt || notif.createdAt),
            icon: notif.type === 'refill' ? User : (notif.type === 'order' ? ShoppingCart : AlertTriangle),
            link: notif.type === 'refill' ? '/refill-alerts' : (notif.type === 'stock_alert' ? '/inventory' : '/orders'),
            unread: !notif.isRead,
            isReal: true
          });
        });

        // Sort by time (newest first)
        allNotifs.sort((a, b) => b.time - a.time);
        // UNREAD FILTER: Only show active alerts in the dropdown to avoid clutter
        setNotifications(allNotifs.filter(n => n.unread).slice(0, 15));
      } catch (err) {
        console.error('Error fetching real notifications:', err);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAsRead = async (notif) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));

    if (notif.isReal) {
      try {
        await markNotificationRead(notif.id);
      } catch (e) { console.error('Failed to mark read on server', e); }
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));

    try {
      await markAllNotificationsRead({ role: 'ADMIN' });
    } catch (e) {
      console.error('Failed to mark all read on server', e);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <header className="topbar">
      <div className="search-bar">
        <Search size={16} color="var(--text-muted)" />
        <input placeholder="Search medicines, orders, patients..." />
      </div>

      <div className="topbar-actions">
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="notification-wrapper" ref={notificationsRef}>
          <button
            className="icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-dot" />}
            {unreadCount > 0 && (
              <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <button
                    className="mark-all-read-btn"
                    onClick={markAllAsRead}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="notification-list">
                {loading ? (
                  <div className="notification-empty">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const Icon = notif.icon;
                    return (
                      <Link
                        key={notif.id}
                        to={notif.link}
                        className={`notification-item ${notif.unread ? 'unread' : ''}`}
                        onClick={() => {
                          markAsRead(notif);
                          setShowNotifications(false);
                        }}
                      >
                        <div className="notification-icon">
                          <Icon size={16} />
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">{notif.title}</div>
                          <div className="notification-message">{notif.message}</div>
                          <div className="notification-time">{formatTime(notif.time)}</div>
                        </div>
                        {notif.unread && <div className="notification-unread-dot" />}
                      </Link>
                    );
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notification-footer">
                  <Link to="/refill-alerts" onClick={() => setShowNotifications(false)}>
                    View all notifications
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="profile-wrapper" ref={profileRef}>
          <div
            className="admin-profile"
            onClick={() => setShowProfile(!showProfile)}
            style={{ cursor: 'pointer' }}
          >
            <div className="admin-avatar">{initials}</div>
            <div className="admin-info">
              <h4>{user?.name || 'System Admin'}</h4>
              <span>Pharmacy Manager</span>
            </div>
            <ChevronDown size={16} style={{ marginLeft: 8, opacity: 0.6, transition: 'transform 0.2s', transform: showProfile ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>

          {showProfile && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <div className="profile-avatar-large">
                  {initials}
                </div>
                <div className="profile-info-large">
                  <h4>{user?.name || 'System Admin'}</h4>
                  <span>{user?.email || 'admin@pharmacy.com'}</span>
                  <div className="profile-role">{user?.role || 'ADMIN'}</div>
                </div>
              </div>

              <div className="profile-menu">
                <Link
                  to="/settings"
                  className="profile-menu-item"
                  onClick={() => setShowProfile(false)}
                >
                  <User size={16} />
                  <span>View Profile</span>
                </Link>
                <Link
                  to="/settings"
                  className="profile-menu-item"
                  onClick={() => setShowProfile(false)}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </Link>
                <div className="profile-menu-divider" />
                <button
                  className="profile-menu-item logout-item"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
