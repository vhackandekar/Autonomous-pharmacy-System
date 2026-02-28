import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { ChevronDown, X, Check, Bell, Pill } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export const Button = ({ children, variant = 'primary', size = 'md', className = '', loading = false, disabled = false, ...props }) => {
  const { theme } = useTheme();

  const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary hover:shadow-brand-secondary/30",
    secondary: "bg-brand-card border-2 border-brand-border-color text-brand-primary hover:bg-brand-hover-tint shadow-sm typography-body",
    accent: "bg-brand-accent text-white shadow-lg shadow-brand-accent/20 hover:opacity-90",
    ghost: "bg-transparent hover:bg-brand-hover-tint text-brand-primary typography-body"
  };

  const sizes = {
    sm: "px-4 py-2 typography-small opacity-100 uppercase-none",
    md: "px-6 py-3 typography-body opacity-100",
    lg: "px-8 py-4 text-base font-black tracking-tight"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : children}
    </button>
  );
};

export const Card = ({ children, className = '', hover = false }) => {
  const { theme } = useTheme();

  return (
    <div className={`
      rounded-[2rem] p-8 transition-all duration-500 border transition-all
      ${theme === 'dark' ? 'glass-card border-white/5' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}
      ${hover ? 'hover:-translate-y-2 hover:shadow-2xl' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

export const Badge = ({ children, variant = 'info', className = '' }) => {
  const { theme } = useTheme();

  const variants = {
    info: theme === 'dark' ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" : "bg-blue-50 text-blue-600 border border-blue-100",
    success: theme === 'dark' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-100",
    warning: theme === 'dark' ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-600 border border-amber-100",
    error: theme === 'dark' ? "bg-rose-500/20 text-rose-400 border border-rose-500/20" : "bg-rose-50 text-rose-600 border border-rose-100",
    purple: theme === 'dark' ? "bg-violet-500/20 text-violet-400 border border-violet-500/20" : "bg-violet-50 text-violet-600 border border-violet-100",
    teal: theme === 'dark' ? "bg-teal-500/20 text-teal-400 border border-teal-500/20" : "bg-teal-50 text-teal-600 border border-teal-100"
  };

  return (
    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};


export const Toggle = ({ enabled, onChange }) => {
  const { theme } = useTheme();

  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
        ${enabled ? 'bg-brand-primary' : theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

export const Dropdown = ({ trigger, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <div className="relative inline-block text-left">
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">{trigger}</div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className={`
            absolute right-0 mt-2 origin-top-right rounded-2xl border border-brand-border-color p-2 z-50 shadow-2xl transition-all duration-300
            bg-brand-card text-brand-text-primary
            ${className || 'w-56'}
          `}>
            {children}
          </div>
        </>
      )}
    </div>
  );
};

export const Toast = ({ message, type = 'success', visible, onClose }) => {
  if (!visible) return null;

  const variants = {
    success: "bg-brand-success text-white",
    info: "bg-brand-primary text-white",
    error: "bg-brand-error text-white"
  };

  return (
    <div className={`
      fixed bottom-6 right-6 z-[100] flex items-center space-x-4 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10
      ${variants[type]}
    `}>
      {type === 'success' ? <Check size={20} /> : <Bell size={20} />}
      <span className="font-bold text-sm tracking-wide">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-lg transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};



export const ChatBubble = ({ role, content, metadata, timestamp }) => {
  const isUser = role === 'user';
  const { theme } = useTheme();
  const { addMessageToActive } = useChat() || {};
  const [selectedDosage, setSelectedDosage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleDosageSubmit = () => {
    if (selectedDosage && addMessageToActive) {
      setIsSubmitted(true);
      addMessageToActive({
        id: Date.now(),
        role: 'user',
        content: `My dosage is: ${selectedDosage}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group animate-in slide-in-from-bottom-2 duration-500`}>
      <div className={`
        relative max-w-[80%] rounded-3xl p-5 transition-all duration-300
        ${isUser
          ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20 rounded-tr-sm'
          : 'bg-brand-card border border-brand-border-color text-brand-text-primary shadow-xl shadow-brand-primary/5 rounded-tl-sm'
        }
      `}>
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">{content}</p>

          {/* Dosage Dropdown for AI messages */}
          {!isUser && metadata?.requiresDosage && metadata?.dosageOptions && !isSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 rounded-2xl bg-brand-primary/5 border border-brand-primary/10 space-y-3"
            >
              <div className="flex items-center space-x-2 text-brand-primary">
                <Pill size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Select Clinical Dosage</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <select
                    className={`w-full appearance-none px-4 py-2.5 rounded-xl text-xs font-bold border border-brand-border-color bg-brand-card text-brand-text-primary focus:ring-2 focus:ring-brand-primary/20 outline-none pr-10`}
                    value={selectedDosage}
                    onChange={(e) => setSelectedDosage(e.target.value)}
                  >
                    <option value="">Choose dosage...</option>
                    {metadata.dosageOptions.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
                </div>
                <button
                  disabled={!selectedDosage}
                  onClick={handleDosageSubmit}
                  className="px-6 py-2.5 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-secondary disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-brand-primary/10 flex items-center justify-center space-x-2"
                >
                  <Check size={14} />
                  <span>Apply</span>
                </button>
              </div>
              <p className="text-[9px] opacity-40 font-bold italic">* Required for medical precision and safety</p>
            </motion.div>
          )}

          {isSubmitted && (
            <div className="mt-2 flex items-center space-x-2 text-brand-success text-[10px] font-bold">
              <Check size={12} />
              <span>Dosage Confirmed</span>
            </div>
          )}

          <div className={`flex items-center space-x-2 mt-2 pt-2 border-t border-white/10 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] font-black uppercase tracking-widest opacity-40`}>
              {timestamp || 'Just now'}
            </span>
            {!isUser && (
              <span className="flex items-center text-[9px] font-black uppercase tracking-widest text-brand-primary">
                <Check size={10} className="mr-1" /> Clinical Precision Core
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
