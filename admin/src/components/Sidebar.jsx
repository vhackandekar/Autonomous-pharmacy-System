import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart,
  Bell, Settings, LogOut, Pill, Users, Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders', badge: '12', badgeColor: 'green' },
  { to: '/ai-intelligence', icon: Bot, label: 'Admin AI' },
  { to: '/manage-vendors', icon: Users, label: 'Manage Vendors' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">💊</div>
        <div className="logo-text">
          <h2>AI Pharmacy</h2>
          <span>Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label, badge, badgeColor }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
            {badge && <span className={`nav-badge ${badgeColor}`}>{badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="signout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
