import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useOrders } from './OrderContext';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { fetchCart, fetchOrders, fetchNotifications } = useOrders();

  // Storage keys
  const HISTORY_KEY = user ? `chat-history-${user.id}` : null;
  const ACTIVE_CHAT_KEY = user ? `active-chat-${user.id}` : null;
  const ACTIVE_SESSION_KEY = user ? `active-session-id-${user.id}` : null;

  const defaultMessages = [
    { id: 1, role: 'ai', content: "Hello! I'm Dr. Saahil, your personal AI Pharmacist. I’m here to help you manage your health and prescriptions. How can I assist you today?", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ];

  // sessions: [{ id, title, messages, timestamp }]
  const [sessions, setSessions] = useState([]);
  const [currentMessages, setCurrentMessages] = useState(defaultMessages);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // Load user-specific data whenever user changes
  useEffect(() => {
    if (user && HISTORY_KEY) {
      // Load sessions
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      setSessions(savedHistory ? JSON.parse(savedHistory) : []);

      // Load active chat
      const savedActive = localStorage.getItem(ACTIVE_CHAT_KEY);
      setCurrentMessages(savedActive ? JSON.parse(savedActive) : defaultMessages);

      // Load active session ID
      const savedSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
      setCurrentSessionId(savedSessionId || null);
    } else {
      // Clear state on logout
      setSessions([]);
      setCurrentMessages(defaultMessages);
      setCurrentSessionId(null);
    }
  }, [user?.id]);

  // Persist sessions to localStorage
  useEffect(() => {
    if (user && HISTORY_KEY) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    }
  }, [sessions, HISTORY_KEY]);

  // Persist active chat to localStorage
  useEffect(() => {
    if (user && ACTIVE_CHAT_KEY) {
      localStorage.setItem(ACTIVE_CHAT_KEY, JSON.stringify(currentMessages));
      if (currentSessionId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, currentSessionId);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    }
  }, [currentMessages, currentSessionId, ACTIVE_CHAT_KEY]);

  // Unified Session Management:
  // Sync currentMessages into the sessions list whenever messages change
  useEffect(() => {
    if (currentMessages.length > 1 && currentSessionId) {
      setSessions(prev =>
        prev.map(s => s.id === currentSessionId ? { ...s, messages: currentMessages } : s)
      );
    }
  }, [currentMessages]);

  useEffect(() => {
    if (currentMessages.length > 1 && !currentSessionId) {
      // Auto-create session on first user interaction if not in one
      const firstUserMsg = currentMessages.find(m => m.role === 'user');
      if (firstUserMsg) {
        const newId = Date.now().toString();
        const newSession = {
          id: newId,
          title: firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : ''),
          messages: currentMessages,
          timestamp: new Date().toISOString()
        };

        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
      }
    }
  }, [currentMessages, currentSessionId]);

  const addMessageToActive = async (msg, skipChatTrigger = false, language = 'English') => {
    // Atomic update with duplicate check
    setCurrentMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });

    if (msg.role === 'user' && !skipChatTrigger) {
      setIsTyping(true);
      try {
        // Send history as an array of message objects {role, content}
        const historyData = currentMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        const { data } = await api.post('/agent/chat', {
          userMessage: msg.content,
          userHistory: historyData,
          language: language
        });

        const aiMsg = {
          id: Date.now() + Math.random(),
          role: 'ai',
          content: data.agentResponse.answer || data.agentResponse.response_message,
          metadata: data.agentResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        addMessageToActive(aiMsg, true); // Don't trigger AI for AI responses

        // Refresh Cart, Orders, and Notifications if the AI performed an action
        fetchCart();
        fetchOrders();
        fetchNotifications();
      } catch (error) {
        console.error("AI Assistant Error:", error);
        addMessageToActive({
          id: Date.now() + 1000,
          role: 'ai',
          content: "I'm sorry, I'm having trouble connecting to my knowledge base. Please ensure your AI API keys (Groq/Gemini) are valid and your server is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, true);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const uploadFile = async (file, text = "") => {
    // Generate local preview for immediate UI update
    const previewUrl = URL.createObjectURL(file);
    const attachment = {
      name: file.name,
      type: file.type,
      size: file.size,
      preview: previewUrl
    };

    const formData = new FormData();
    formData.append('prescription', file);

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text || "",
      attachment: attachment,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addMessageToActive(userMsg, true); // Skip normal chat trigger for uploads
    setIsTyping(true);

    try {
      const { data } = await api.post('/agent/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const aiMsg = {
        id: Date.now() + Math.random(),
        role: 'ai',
        content: data.agentResponse.answer,
        metadata: data.agentResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      addMessageToActive(aiMsg);
      fetchCart();
      fetchOrders();
      fetchNotifications();
    } catch (error) {
      console.error("File upload error:", error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || "I encountered an error while processing your document. Please try a smaller file (Max 15MB).";
      addMessageToActive({
        id: Date.now() + 1000,
        role: 'ai',
        content: `I'm sorry, I couldn't process that: ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } finally {
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    setCurrentMessages(defaultMessages);
    setCurrentSessionId(null);
    if (ACTIVE_SESSION_KEY) localStorage.removeItem(ACTIVE_SESSION_KEY);
    if (ACTIVE_CHAT_KEY) localStorage.removeItem(ACTIVE_CHAT_KEY);
  };

  const loadSession = (id) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentMessages(session.messages);
      setCurrentSessionId(session.id);
    }
  };

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      startNewChat();
    }
  };

  const clearAllHistory = () => {
    setSessions([]);
    if (HISTORY_KEY) localStorage.removeItem(HISTORY_KEY);
    if (ACTIVE_CHAT_KEY) localStorage.removeItem(ACTIVE_CHAT_KEY);
    if (ACTIVE_SESSION_KEY) localStorage.removeItem(ACTIVE_SESSION_KEY);
    startNewChat();
  };

  return (
    <ChatContext.Provider value={{
      sessions,
      currentMessages,
      addMessageToActive,
      startNewChat,
      loadSession,
      deleteSession,
      clearAllHistory,
      uploadFile,
      isTyping
    }}>
      {children}
    </ChatContext.Provider>
  );
};
