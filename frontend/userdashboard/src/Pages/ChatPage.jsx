import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, Paperclip, Plus, MessageSquare,
  Trash2, Globe, Sparkles, Loader2, PanelLeftClose, PanelLeft,
  XCircle, CheckCircle2, PauseCircle, PlayCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useOrders } from '../context/OrderContext';
import { useSidebar } from '../context/SidebarContext';
import { useChat } from '../context/ChatContext';
import { Button, ChatBubble, Badge, Toast } from '../Component/UI';

const ChatPage = () => {
  const { theme, language } = useTheme();
  const { placeOrder } = useOrders();
  const { collapseSidebar, expandSidebar } = useSidebar();
  const {
    sessions,
    currentMessages: messages,
    addMessageToActive,
    startNewChat,
    loadSession,
    deleteSession,
    clearAllHistory,
    uploadFile,
    isTyping
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const [shouldDiscard, setShouldDiscard] = useState(false);

  const { setLanguage } = useTheme();

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        setShouldDiscard(false);
      };
      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setShouldDiscard(false);
        setToastMsg(`Error: ${event.error}`);
        setShowToast(true);
      };
      recognitionRef.current.onresult = (event) => {
        if (shouldDiscard) return;
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => (prev ? `${prev} ${transcript}` : transcript));
      };
    }
  }, [shouldDiscard]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setToastMsg("Speech recognition is not supported in this browser.");
      setShowToast(true);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setShouldDiscard(false);
      recognitionRef.current.start();
    }
  };

  const cancelListening = () => {
    if (recognitionRef.current) {
      setShouldDiscard(true);
      recognitionRef.current.stop();
    }
  };

  const languages = [
    { name: 'English', flag: '🇺🇸' },
    { name: 'Hindi', flag: '🇮🇳' },
    { name: 'Spanish', flag: '🇪🇸' },
    { name: 'French', flag: '🇫🇷' },
    { name: 'German', flag: '🇩🇪' },
    { name: 'Chinese', flag: '🇨🇳' },
    { name: 'Arabic', flag: '🇸🇦' }
  ];

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setToastMsg(`Uploading ${file.name}...`);
      setShowToast(true);
      await uploadFile(file);
    }
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addMessageToActive(userMsg);
    setInputValue('');
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-brand-background">

      {/* 1. Left: Conversation History (Collapsible Sidebar) */}
      <motion.div
        animate={{ width: sidebarCollapsed ? 0 : 280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`flex-shrink-0 overflow-hidden flex flex-col hidden xl:flex border-r ${theme === 'dark'
          ? 'bg-slate-900 border-white/5'
          : 'bg-gradient-to-b from-blue-50 via-indigo-50/50 to-white border-indigo-100'
          }`}
      >
        <div className="w-[280px] flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={`px-4 pt-5 pb-3 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
            <button
              onClick={startNewChat}
              className={`w-full flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${theme === 'dark'
                ? 'bg-brand-primary/15 text-brand-primary hover:bg-brand-primary/25 border border-brand-primary/20'
                : 'bg-brand-primary text-white hover:bg-brand-secondary shadow-md shadow-brand-primary/20'
                }`}>
              <Plus size={16} />
              <span>New Conversation</span>
              {/* Force rebuild */}
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar">
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 pb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`}>Previous Conversations</p>

            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs opacity-40 font-bold">No history yet</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center group relative cursor-pointer ${theme === 'dark'
                    ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
                    }`}>
                  <MessageSquare size={15} className="mr-3 opacity-50" />
                  <span className="truncate font-medium flex-1">{session.title}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`p-3 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
            <button
              onClick={clearAllHistory}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${theme === 'dark'
                ? 'text-rose-400 hover:bg-rose-500/10'
                : 'text-rose-500 hover:bg-rose-50'
                }`}>
              <Trash2 size={15} />
              <span>Clear All History</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. Right: Message Window */}
      <div className="flex-1 flex flex-col relative bg-transparent">

        {/* Chat Header */}
        <div className="px-8 py-4 flex items-center justify-between border-b border-brand-border-color bg-brand-card/50 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            {/* Sidebar toggle button visible on xl+ */}
            <button
              onClick={() => setSidebarCollapsed(prev => !prev)}
              className="hidden xl:flex p-2 hover:bg-brand-hover-tint rounded-lg text-brand-text-secondary transition-all"
            >
              {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="font-black text-sm tracking-tight text-brand-text-primary">AI Pharmacist</h4>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest text-brand-text-secondary">Clinical Precision Core</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className={`p-2 rounded-lg text-brand-text-secondary transition-all ${isLangMenuOpen ? 'bg-brand-primary/20 text-brand-primary' : 'hover:bg-brand-hover-tint'}`}
            >
              <Globe size={18} />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute right-0 top-full mt-2 w-48 rounded-2xl shadow-2xl border z-50 overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="py-2 px-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] px-3 pb-2 opacity-40">Select Language</p>
                    {languages.map((lang) => (
                      <button
                        key={lang.name}
                        onClick={() => {
                          setLanguage(lang.name);
                          setIsLangMenuOpen(false);
                          setToastMsg(`Language set to ${lang.name}`);
                          setShowToast(true);
                        }}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${language === lang.name
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : 'hover:bg-brand-hover-tint text-brand-text-secondary hover:text-brand-text-primary'
                          }`}
                      >
                        <span className="text-sm">{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                metadata={msg.metadata}
                timestamp={msg.timestamp}
              />
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-3xl p-4 flex items-center space-x-3 bg-brand-card shadow-sm border border-brand-border-color">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40 text-brand-text-primary">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="p-6 bg-brand-background border-t border-brand-border-color">
          <div className="max-w-3xl mx-auto relative">

            {/* Voice Recording Overlay */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute inset-0 z-30 rounded-2xl flex items-center justify-between px-6 shadow-2xl ${theme === 'dark' ? 'bg-brand-primary' : 'bg-brand-primary shadow-brand-primary/20'
                    }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5 min-w-[120px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <motion.div
                          key={i}
                          animate={{ height: [10, 24, 10] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                          className="w-1 rounded-full bg-white"
                        />
                      ))}
                    </div>
                    <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Recording Audio...</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 group"
                      title="Pause/Finish"
                    >
                      <PauseCircle size={22} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelListening}
                      className="p-2.5 rounded-xl bg-brand-error/20 hover:bg-brand-error/30 text-white transition-all active:scale-95 group"
                      title="Cancel Recording"
                    >
                      <XCircle size={22} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleListening}
                      className="p-2.5 rounded-xl bg-white text-brand-primary hover:bg-white/95 transition-all active:scale-95 shadow-lg group"
                      title="Finish"
                    >
                      <CheckCircle2 size={22} className="group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSendMessage} className="rounded-2xl p-2 flex items-center border border-brand-border-color bg-brand-card transition-all duration-300 focus-within:ring-4 focus-within:ring-brand-primary/5 focus-within:border-brand-primary/50 shadow-xl shadow-brand-primary/5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="p-3 rounded-xl text-brand-text-secondary hover:text-brand-primary hover:bg-brand-hover-tint transition-all"
              >
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message AI Pharmacist..."
                className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm font-bold text-brand-text-primary placeholder:text-brand-text-secondary/30"
              />
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-xl transition-all ${isListening ? 'bg-brand-error text-white shadow-lg shadow-brand-error/20' : 'text-brand-text-secondary hover:text-brand-primary hover:bg-brand-hover-tint'}`}
                >
                  <Mic size={20} />
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className={`p-3 rounded-xl transition-all flex items-center justify-center ${!inputValue.trim()
                    ? 'bg-brand-hover-tint text-brand-text-secondary/20 cursor-not-allowed'
                    : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary active:scale-95'
                    }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Toast
        message={toastMsg}
        visible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

export default ChatPage;
