import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ChevronDown, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- FRONTEND VALIDATION ---
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    if (password.length < 8) {
      alert("Password must be at least 8 characters long.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data } = await authAPI.login({ email, password });

      if (data.token) {
        // Prepare user data for context
        const userData = {
          ...data.user,
          initials: data.user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          role: 'User' // Default to User
        };

        login(userData, data.token);
        navigate('/chat');
      }
    } catch (error) {
      console.error("Login failed:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || "Login failed. Please check your credentials.";
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0b14] flex items-center justify-center p-4">
      {/* Background Animated Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="bg-shape w-72 h-72 bg-purple-900/10 top-[-5%] left-[-5%] blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="bg-shape w-96 h-96 bg-indigo-900/10 bottom-[-10%] right-[-5%] blur-[120px]"
        />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-[#11121e] w-full max-w-[400px] p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl relative z-10"
      >
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-2.5 mb-3 rounded-xl bg-[#1c1d2b] border border-white/5 shadow-lg group">
            <Activity className="w-6 h-6 text-purple-500 transition-transform group-hover:scale-110" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">
            AI Pharmacy
          </h1>
          <p className="text-white/30 font-black uppercase tracking-[0.2em] text-[9px]">
            Secure Access Portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-500 transition-colors" />
              <input
                type="email"
                required
                autoComplete="off"
                name="email_hidden"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full bg-[#1c1d2b]/50 border border-white/5 rounded-xl py-3 pl-11 pr-5 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-500 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1c1d2b]/50 border border-white/5 rounded-xl py-3 pl-11 pr-12 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Additional Links */}
          <div className="flex items-center justify-end px-1">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-white/40 text-xs font-bold hover:text-white transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={isLoading || !email || !password}
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-black py-4 rounded-2xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-purple-900/10 mt-2"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Activity className="w-5 h-5" />
              </motion.div>
            ) : (
              <span>Login</span>
            )}
          </motion.button>

          {/* Sign Up Link */}
          <p className="text-center text-[11px] font-bold text-white/30 pt-1">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-purple-500 hover:text-purple-400 transition-colors ml-1"
            >
              Create Account
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
