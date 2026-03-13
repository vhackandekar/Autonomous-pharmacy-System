import React, { useState, useEffect } from 'react';
import {
  Moon, Sun, Globe, Mic, Bell, Shield,
  User, Sliders, Check, LogOut, HeartPulse, History
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Toggle, Button, Badge } from '../Component/UI';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const {
    theme, toggleTheme,
    language, setLanguage,
    voiceMode, setVoiceMode
  } = useTheme();

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Dynamic notification states
  const [notifications, setNotifications] = useState({
    refillAlerts: user?.refillAlerts ?? true,
    orderUpdates: user?.orderUpdates ?? true
  });

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Mar 2024';

  const updatePreference = async (updates) => {
    setSaving(true);
    try {
      // In a real app, this would sync to the specific user profile endpoint
      await authAPI.updateProfile(updates);
      updateUser(updates);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error("Failed to sync clinical settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotification = (key) => {
    const newVal = !notifications[key];
    const newNotifications = { ...notifications, [key]: newVal };
    setNotifications(newNotifications);
    updatePreference(newNotifications);
  };

  const sections = [
    {
      title: "Diagnostic Interface",
      icon: <Sliders className="text-blue-500" />,
      items: [
        {
          label: "Clinical Theme",
          desc: "Switch between high-contrast dark and standard clinical light modes.",
          control: (
            <div className="flex items-center space-x-3">
              {theme === 'dark' ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-amber-500" />}
              <Toggle enabled={theme === 'dark'} onChange={() => {
                toggleTheme();
                updatePreference({ theme: theme === 'dark' ? 'light' : 'dark' });
              }} />
            </div>
          )
        },
        {
          label: "Voice Assistance",
          desc: "Enable AI-driven voice interactions for prescription reading.",
          control: <Toggle enabled={voiceMode} onChange={() => {
            const next = !voiceMode;
            setVoiceMode(next);
            updatePreference({ voiceMode: next });
          }} />
        }
      ]
    },
    {
      title: "Global Connectivity",
      icon: <Globe className="text-emerald-500" />,
      items: [
        {
          label: "System Language",
          desc: "Regional localization for medical reports and chat interface.",
          control: (
            <select
              value={language}
              onChange={(e) => {
                const val = e.target.value;
                setLanguage(val);
                updatePreference({ language: val });
              }}
              className={`text-xs font-bold rounded-xl border p-2.5 outline-none transition-all ${theme === 'dark'
                ? 'bg-[#1A1825] border-white/10 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-blue-500'
                }`}
            >
              <option value="English">English (US)</option>
              <option value="Marathi">Marathi (मराठी)</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
            </select>
          )
        }
      ]
    },
    {
      title: "Health Monitoring",
      icon: <Bell className="text-rose-500" />,
      items: [
        {
          label: "Smart Refill Alerts",
          desc: "Predictive notifications when active prescriptions require renewal.",
          control: <Toggle enabled={notifications.refillAlerts} onChange={() => handleToggleNotification('refillAlerts')} />
        },
        {
          label: "Logistics Updates",
          desc: "Real-time tracking notifications for your medical deliveries.",
          control: <Toggle enabled={notifications.orderUpdates} onChange={() => handleToggleNotification('orderUpdates')} />
        }
      ]
    }
  ];

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter mb-2 bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
            Account Configuration
          </h2>
          <p className="text-sm opacity-50 font-semibold uppercase tracking-widest text-slate-500">Clinical Dashboard Preferences</p>
        </div>
        <div className="flex items-center space-x-3">
          {saving && <Badge variant="secondary" className="animate-pulse">Syncing...</Badge>}
          {success && (
            <Badge variant="success" className="animate-bounce-short">
              <Check size={12} className="mr-1" /> Profile Synced
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center space-x-3 px-1">
              <div className={`p-2 rounded-xl bg-opacity-10 ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}>
                {section.icon}
              </div>
              <h4 className="font-black text-[11px] uppercase tracking-[0.25em] opacity-40">{section.title}</h4>
            </div>
            <Card className={`divide-y p-0 overflow-hidden shadow-2xl shadow-black/5 rounded-3xl ${theme === 'dark' ? 'divide-white/5 border-white/5 bg-[#12111A]' : 'divide-slate-100 border-slate-200'
              }`}>
              {section.items.map((item, i) => (
                <div key={i} className={`p-6 flex items-center justify-between group transition-all duration-300 ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                  }`}>
                  <div className="max-w-md">
                    <p className={`text-[15px] font-bold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                    <p className="text-[11px] font-medium opacity-40 leading-relaxed max-w-[300px]">{item.desc}</p>
                  </div>
                  <div>{item.control}</div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>

      {/* Profile Focus Card */}
      <div className="pt-6">
        <Card className={`relative overflow-hidden p-8 rounded-[32px] border-none shadow-2xl transition-all hover:scale-[1.01] duration-500 ${theme === 'dark' ? 'bg-gradient-to-br from-[#1E1B33] to-[#12111A]' : 'bg-gradient-to-br from-slate-50 to-white border border-slate-100'
          }`}>
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield size={120} />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl font-black text-white bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-2xl shadow-blue-500/40`}>
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#12111A] flex items-center justify-center">
                  <Check size={12} className="text-white" strokeWidth={4} />
                </div>
              </div>
              <div>
                <h3 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user?.name || 'Authorized Guest'}</h3>
                <div className="flex items-center space-x-3 mt-1 underline-offset-4">
                  <div className="flex items-center space-x-1 text-[11px] font-bold text-emerald-500 lowercase">
                    <HeartPulse size={10} />
                    <span>Verified Patient</span>
                  </div>
                  <span className="text-[11px] font-bold opacity-30 uppercase tracking-widest">• Member since {memberSince}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                className="rounded-2xl px-6 py-6 font-black text-[11px] uppercase tracking-widest shadow-xl"
                onClick={() => navigate('/profile')}
              >
                <User size={14} className="mr-2" />
                Edit Record
              </Button>
              <Button
                variant="ghost"
                className="rounded-2xl px-6 py-6 font-black text-[11px] uppercase tracking-widest text-rose-500 hover:bg-rose-500/10"
                onClick={logout}
              >
                <LogOut size={14} className="mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="text-center pt-8">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20">Pharmacy Core Engine • Version 2.0.4-Clinical</p>
      </div>
    </div>
  );
};

export default SettingsPage;
