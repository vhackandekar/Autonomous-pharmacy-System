import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../services/api';
import { KeyRound, CheckCircle2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(''); // Store token for direct reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('email'); // 'email' or 'reset'
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data } = await authAPI.forgotPassword(email);
      // For development direct flow, we use the token returned
      if (data.token) {
        setToken(data.token);
        setStep('reset');
      } else {
        // Fallback for production where token is only in email
        setIsSubmitted(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to verify email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await authAPI.resetPassword(token, newPassword);
      setIsSubmitted(true);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0A14] p-8 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-900/10 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-900/10 blur-[100px] rounded-full"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-purple-500/30 shadow-xl shadow-purple-500/20 space-y-5 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-500/10 mb-2">
            {step === 'email' ? <KeyRound className="w-8 h-8 text-purple-400" /> : <ShieldCheck className="w-8 h-8 text-emerald-400" />}
          </div>
          <h1 className={`text-3xl font-black tracking-tighter ${step === 'email' ? 'text-purple-400' : 'text-emerald-400'}`}>
            {step === 'email' ? "Account Recovery" : "Set New Password"}
          </h1>
          <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
            {step === 'email' ? "Identity Verification Phase" : "Credential Rotation Phase"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            step === 'email' ? (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleEmailSubmit}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-black uppercase text-red-500 text-center">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Registered Email</label>
                  <input
                    type="email"
                    required
                    placeholder="example@gmail.com"
                    className="w-full bg-[#141225] border border-purple-800/50 text-white rounded-xl px-4 py-3 text-sm focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-purple-900/20 disabled:opacity-50"
                >
                  {isLoading ? "Verifying..." : "Verify Account"}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="reset-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleResetSubmit}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-black uppercase text-red-500 text-center">
                    {error}
                  </div>
                )}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 ml-1">New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full bg-[#141225] border border-emerald-800/50 text-white rounded-xl px-4 py-3 text-sm focus:border-emerald-400 transition-all outline-none"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 bottom-3 text-white/20 hover:text-white">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60 ml-1">Confirm Update</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-[#141225] border border-emerald-800/50 text-white rounded-xl px-4 py-3 text-sm focus:border-emerald-400 transition-all outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all"
                >
                  {isLoading ? "Updating..." : "Rotate Credentials"}
                </button>
              </motion.form>
            )
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-3"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" strokeWidth={3} />
              <p className="text-white font-black text-sm">Security Record Updated</p>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Redirecting to Portal...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center space-x-2 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors pt-4"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Cancel Recovery</span>
        </button>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
