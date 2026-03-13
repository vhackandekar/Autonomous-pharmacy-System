import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved user and token on initial load
    const savedUser = localStorage.getItem('auth-user');
    const token = localStorage.getItem('token');

    if (savedUser && token) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Ensure id compatibility for both _id and id (self-healing)
        if (parsedUser && parsedUser._id && !parsedUser.id) {
          parsedUser.id = parsedUser._id;
        }
        setUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse saved user:", error);
        localStorage.removeItem('auth-user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    // Ensure id compatibility for both _id and id (self-healing)
    const patchedUser = { ...userData };
    if (patchedUser && patchedUser._id && !patchedUser.id) {
      patchedUser.id = patchedUser._id;
    }
    setUser(patchedUser);
    localStorage.setItem('auth-user', JSON.stringify(patchedUser));
    if (token) localStorage.setItem('token', token);
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const newUser = { ...prev, ...updates };
      if (newUser._id && !newUser.id) newUser.id = newUser._id;
      localStorage.setItem('auth-user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('token');
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
