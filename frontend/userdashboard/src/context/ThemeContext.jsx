import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');
  const [language, setLanguage] = useState(() => localStorage.getItem('app-lang') || 'English');
  const [voiceMode, setVoiceMode] = useState(() => localStorage.getItem('app-voice') === 'true');

  useEffect(() => {
    if (user) {
      if (user.theme) setTheme(user.theme);
      if (user.language) setLanguage(user.language);
      if (user.voiceMode !== undefined) setVoiceMode(user.voiceMode);
    }
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('app-lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app-voice', voiceMode);
  }, [voiceMode]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, setTheme,
      language, setLanguage,
      voiceMode, setVoiceMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
