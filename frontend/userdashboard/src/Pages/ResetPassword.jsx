import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';

const ResetPassword = () => {
    const navigate = useNavigate();
    const { token } = useParams();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
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
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to reset password. Link may be invalid or expired.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0A14] p-8 overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-900/10 blur-[100px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-emerald-900/10 blur-[100px] rounded-full"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-emerald-500/30 shadow-xl shadow-emerald-500/20 space-y-5 relative z-10"
            >
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 mb-2">
                        <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                        New Password
                    </h1>
                    <p className="text-emerald-300/60 text-sm">
                        Please enter your new medical-grade password
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {!isSubmitted ? (
                        <motion.form
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-500 text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-medium text-emerald-300/70 ml-1">New Password</label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-[#141225] border border-emerald-800 text-white rounded-lg px-4 py-3 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 outline-none transition-all duration-300"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 bottom-3.5 text-emerald-500/40 hover:text-emerald-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300/70 ml-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-[#141225] border border-emerald-800 text-white rounded-lg px-4 py-3 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 outline-none transition-all duration-300"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !newPassword || !confirmPassword}
                                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-semibold py-3 rounded-lg hover:scale-105 hover:shadow-emerald-500/40 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? "Updating..." : "Update Password"}
                            </button>
                        </motion.form>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-xl text-center space-y-3"
                        >
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                            <p className="text-emerald-200 text-sm font-bold">
                                Success! Your password has been rotated.
                            </p>
                            <p className="text-[10px] text-emerald-300/40">
                                Redirecting to clinical login...
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => navigate('/login')}
                    className="w-full flex items-center justify-center space-x-2 text-xs text-emerald-300/40 hover:text-emerald-300 transition-colors pt-2 group"
                >
                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Login</span>
                </button>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
