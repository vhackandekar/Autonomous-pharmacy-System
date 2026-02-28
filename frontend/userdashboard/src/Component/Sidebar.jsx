import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, ClipboardList, Activity, FileText,
  Calendar, Settings, LogOut, Sun, Moon, User, ChevronRight, MapPin
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { Toggle } from './UI';

const Sidebar = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'AI Chat', icon: <MessageSquare size={20} />, path: '/chat' },
    { name: 'My Orders', icon: <ClipboardList size={20} />, path: '/orders' },
    { name: 'Prescriptions', icon: <FileText size={20} />, path: '/prescriptions' },
    { name: 'History', icon: <Calendar size={20} />, path: '/history' },
    { name: 'Dispatch Profile', icon: <MapPin size={20} />, path: '/profile' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const activeItem = menuItems.find(item => location.pathname === item.path) || menuItems[0];

  return (
    <>
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 260,
          translateX: (typeof window !== 'undefined' && window.innerWidth < 1024) ? (isMobileOpen ? 0 : -260) : 0
        }}
        transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
        className={`
          fixed left-0 top-0 h-screen z-50 flex flex-col border-r border-brand-sidebar-border shadow-2xl
          ${theme === 'dark' ? 'glass-container' : 'bg-brand-sidebar-bg'} text-brand-sidebar-text
          ${!isMobileOpen ? 'lg:flex' : 'flex'}
        `}
      >
        {/* Logo Section */}
        <div className={`flex items-center py-8 px-6 space-x-4 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className={`min-w-[44px] h-[44px] rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 ${theme === 'dark' ? 'bg-brand-primary neon-glow-purple' : 'bg-brand-accent shadow-brand-accent/30'} text-white`}>
            <Activity size={26} />
          </div>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-hidden"
            >
              <h1 className="text-xl typography-heading whitespace-nowrap text-white uppercase tracking-tighter">AI Pharmacy</h1>
              <p className="typography-small opacity-40 whitespace-nowrap text-brand-sidebar-text-muted">Health-Tech Core</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          {!isCollapsed && (
            <p className="typography-small opacity-20 px-4 mb-4 text-brand-sidebar-text-muted">Navigation</p>
          )}

          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) closeMobileSidebar();
                }}
                className={`
                  w-full flex items-center py-3.5 rounded-2xl transition-all duration-300 relative group
                  ${isCollapsed ? 'justify-center px-0' : 'px-5'}
                  ${isActive
                    ? 'bg-brand-sidebar-active text-white shadow-lg shadow-brand-sidebar-active/30 scale-[1.02]'
                    : 'hover:bg-brand-sidebar-hover text-brand-sidebar-text-muted hover:text-white'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className={`absolute left-0 w-1.5 h-6 rounded-r-full bg-white ${theme === 'dark' ? 'shadow-[0_0_15px_rgba(139,92,246,0.8)]' : 'shadow-[0_0_15px_rgba(255,255,255,0.4)]'}`}
                  />
                )}

                <span className={`transition-all duration-300 group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-4 text-sm font-bold whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}

                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <div className="absolute left-[calc(100%+15px)] px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 translate-x-3 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-[60] bg-brand-primary text-white shadow-xl">
                    {item.name}
                    {/* Tooltip Arrow */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 border-4 border-transparent border-r-brand-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 mt-auto space-y-4 border-t border-brand-sidebar-border">
          {!isCollapsed && (
            <div className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50 hover:bg-slate-100'}`}>
              <div className="flex items-center space-x-2">
                {theme === 'dark' ? <Moon size={16} className="text-brand-accent" /> : <Sun size={16} className="text-amber-500" />}
                <span className="typography-small opacity-60 text-brand-sidebar-text-muted">Theme</span>
              </div>
              <Toggle enabled={theme === 'dark'} onChange={toggleTheme} />
            </div>
          )}
          {isCollapsed && (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center p-3 rounded-2xl hover:bg-brand-sidebar-hover transition-all group"
            >
              {theme === 'dark' ? <Moon size={18} className="text-brand-accent group-hover:scale-110 transition-transform" /> : <Sun size={18} className="text-amber-500 group-hover:scale-110 transition-transform" />}
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
