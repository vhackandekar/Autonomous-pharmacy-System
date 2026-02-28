import { Bell, User, Settings, LogOut, ChevronDown, PanelLeftClose, PanelLeft, ShoppingCart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useOrders } from '../context/OrderContext';
import { Dropdown } from './UI';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { cart, notifications, markNotificationAsRead, markAllNotificationsAsRead } = useOrders();
  const navigate = useNavigate();
  const location = useLocation();

  const isChat = location.pathname === '/chat';

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-40 px-8 ${isChat ? 'py-2' : 'py-5'} border-b border-brand-border-color transition-all duration-300 ${theme === 'dark' ? 'glass-container' : 'bg-white shadow-sm'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                toggleMobileSidebar();
              } else {
                toggleSidebar();
              }
            }}
            className="p-2.5 rounded-xl transition-all duration-300 active:scale-90 text-brand-text-primary hover:bg-brand-hover-tint"
          >
            <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}>
              {isCollapsed ? <PanelLeft size={22} /> : <PanelLeftClose size={22} />}
            </div>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Cart Icon */}
          <button
            onClick={() => navigate('/cart')}
            className={`relative p-2.5 rounded-xl transition-all active:scale-95 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <ShoppingCart size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[9px] font-black flex items-center justify-center shadow-lg shadow-brand-primary/30">
                {cart.length}
              </span>
            )}
          </button>

          {/* Notifications */}
          <Dropdown
            className="w-80 md:w-96 p-0 overflow-hidden"
            trigger={
              <button className={`relative p-2.5 rounded-xl transition-all active:scale-95 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <Bell size={22} />
                {notifications.some(n => !n.isRead && ['refill', 'order', 'prescription', 'medicine_available'].includes(n.type)) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-primary border-2 border-brand-card shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                )}

              </button>
            }
          >
            <div className="flex flex-col max-h-[480px]">
              <div className="p-4 border-b border-brand-border-color flex items-center justify-between bg-brand-hover-tint/30">
                <h4 className="text-sm font-black uppercase tracking-widest">Notifications</h4>
                <button
                  className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:underline"
                  onClick={() => markAllNotificationsAsRead()}
                >
                  Mark all as read
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
                {notifications.filter(n => ['refill', 'order', 'prescription', 'medicine_available'].includes(n.type)).length === 0 ? (
                  <div className="p-8 text-center opacity-40">
                    <p className="text-xs font-bold italic">No alerts for you yet</p>
                  </div>
                ) : (
                  notifications
                    .filter(n => ['refill', 'order', 'prescription', 'medicine_available'].includes(n.type))
                    .sort((a, b) => (a.type === 'refill' ? -1 : 1)) // Prioritize refill alerts at top
                    .map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => !notif.isRead && markNotificationAsRead(notif._id)}
                        className={`flex items-start space-x-4 px-4 py-4 hover:bg-brand-hover-tint transition-colors cursor-pointer relative group ${!notif.isRead ? 'bg-brand-primary/[0.03]' : ''}`}
                      >
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-brand-primary shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={`text-xs font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                              {notif.type?.replace('_', ' ') || 'System Alert'}
                            </p>
                            <span className="text-[9px] font-bold opacity-30 whitespace-nowrap ml-2">
                              {new Date(notif.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className={`text-[11px] font-medium leading-relaxed ${!notif.isRead ? 'text-brand-text-primary' : 'text-brand-text-secondary'} line-clamp-2`}>
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="p-3 bg-brand-hover-tint/20 border-t border-brand-border-color">
                <button onClick={() => navigate('/history')} className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-brand-text-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all">
                  View All Activity
                </button>
              </div>
            </div>
          </Dropdown>

          {/* User Profile */}
          <Dropdown
            trigger={
              <button className={`flex items-center space-x-3 p-1.5 pl-3 rounded-2xl border border-transparent transition-all active:scale-95 group ${theme === 'dark' ? 'hover:bg-white/5 hover:border-white/10' : 'hover:bg-slate-50 hover:border-slate-200'}`}>
                <div className="text-right hidden sm:block">
                  <p className={`text-xs font-black leading-none group-hover:text-brand-primary transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                    {user?.name || 'User'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-brand-primary/20 transition-transform group-hover:scale-105 ${theme === 'dark' ? 'bg-brand-primary neon-glow-purple' : 'bg-brand-primary'}`}>
                  {user?.initials || 'U'}
                </div>
                <ChevronDown size={14} className="text-brand-text-secondary group-hover:text-brand-primary transition-colors ml-1" />
              </button>
            }
          >
            <div className="grid grid-cols-1 divide-y divide-brand-border-color min-w-[200px]">
              <div className="p-4 pb-3">
                <p className={`text-sm font-black truncate ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{user?.name}</p>
                <p className="text-[11px] font-medium text-brand-text-secondary truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="p-2">
                <button onClick={() => navigate('/profile')} className="w-full flex items-center space-x-3 p-2 rounded-xl text-brand-text-secondary hover:bg-brand-hover-tint hover:text-brand-primary transition-all">
                  <User size={16} />
                  <span className="typography-body text-xs">Profile</span>
                </button>
                <button onClick={() => navigate('/settings')} className="w-full flex items-center space-x-3 p-2 rounded-xl text-brand-text-secondary hover:bg-brand-hover-tint hover:text-brand-primary transition-all">
                  <Settings size={16} />
                  <span className="typography-body text-xs">Settings</span>
                </button>
              </div>
              <div className="p-2">
                <button onClick={handleSignOut} className="w-full flex items-center space-x-3 p-2 rounded-xl text-brand-error hover:bg-brand-error/5 transition-all">
                  <LogOut size={16} />
                  <span className="typography-body text-xs font-bold">Sign Out</span>
                </button>
              </div>
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
};

export default Header;
