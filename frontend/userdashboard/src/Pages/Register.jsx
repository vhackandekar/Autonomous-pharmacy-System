import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const Register = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // --- FRONTEND STRONG VALIDATION ---
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nameRegex = /^[A-Za-z\s]{2,}$/;
    // Password: Min 8 chars, 1 upper, 1 lower, 1 number, 1 special
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!nameRegex.test(formData.fullName.trim())) {
      alert("Name must be at least 2 characters long and contain only letters.");
      return false;
    }
    if (!emailRegex.test(formData.email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    if (!passwordRegex.test(formData.password)) {
      alert("Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.");
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      alert("Phone number must be exactly 10 digits.");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Call backend registration
      const response = await authAPI.register({
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone
      });

      // Notify user and navigate to Login
      setShowPopup(true);
      setTimeout(() => {
        setIsLoading(false);
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error("Registration failed:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || "Registration failed. Please try again.";
      alert(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0A14] p-8 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-900/20 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-900/20 blur-[100px] rounded-full"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-purple-500/20 shadow-[0_0_50px_-12px_rgba(124,58,237,0.3)] space-y-5 relative z-10"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-purple-300/60 text-sm font-medium tracking-wide">
            Join AI Pharmacy Platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-purple-300/70 ml-1">Full Name</label>
            <input
              type="text"
              required
              autoComplete="off"
              placeholder="John Doe"
              className="w-full bg-[#141225] border border-purple-800 text-white rounded-lg px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 outline-none transition-all duration-300 placeholder:text-purple-300/20"
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-purple-300/70 ml-1">Email Address</label>
              <input
                type="email"
                required
                autoComplete="off"
                placeholder="example@gmail.com"
                className="w-full bg-[#141225] border border-purple-800 text-white rounded-lg px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 outline-none transition-all duration-300 placeholder:text-purple-300/20"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-purple-300/70 ml-1">Phone Number</label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                className="w-full bg-[#141225] border border-purple-800 text-white rounded-lg px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 outline-none transition-all duration-300 placeholder:text-purple-300/20"
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-purple-300/70 ml-1">Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-[#141225] border border-purple-800 text-white rounded-lg px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 outline-none transition-all duration-300 placeholder:text-purple-300/20"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-purple-300/70 ml-1">Confirm</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-[#141225] border border-purple-800 text-white rounded-lg px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40 outline-none transition-all duration-300 placeholder:text-purple-300/20"
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white font-bold py-3 rounded-lg mt-2 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-xs text-purple-300/40 pt-2">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/')}
            className="text-purple-400 font-semibold hover:text-purple-300 transition-colors ml-1"
          >
            Login
          </button>
        </p>
      </motion.div>

      {/* Success Popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="absolute bottom-10 z-50 bg-[#141225] border border-purple-500/30 px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(124,58,237,0.2)] flex items-center space-x-4 backdrop-blur-md"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Account Created!</h4>
              <p className="text-purple-300/60 text-xs text-nowrap">Welcome to AI Pharmacy Platform.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Register;
