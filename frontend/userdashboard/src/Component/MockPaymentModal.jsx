import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';

const MockPaymentModal = ({ isOpen, onClose, total, onPaymentSuccess }) => {
    const [step, setStep] = useState('select'); // select, processing, success
    const [method, setMethod] = useState('card');

    useEffect(() => {
        if (!isOpen) {
            setStep('select');
        }
    }, [isOpen]);

    const handlePay = () => {
        setStep('processing');
        setTimeout(() => {
            setStep('success');
            setTimeout(() => {
                onPaymentSuccess();
                onClose();
            }, 2000);
        }, 2500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg tracking-tight">Checkout</h3>
                                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-40">AI Pharmacy Secure Pay</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center opacity-40 hover:opacity-100 transition-all font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            {step === 'select' && (
                                <div className="space-y-6">
                                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold opacity-40 uppercase tracking-wider mb-1">Amount to pay</p>
                                            <p className="text-2xl font-black text-blue-500">₹{total?.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full">
                                            <Lock size={12} /> Secure
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-sm font-black tracking-tight flex items-center gap-2">
                                            Select Payment Method
                                        </p>

                                        <button
                                            onClick={() => setMethod('card')}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${method === 'card' ? 'border-blue-500 bg-blue-500/5' : 'border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${method === 'card' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-white/5 opacity-50'
                                                }`}>
                                                💳
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-black text-sm">Credit / Debit Card</p>
                                                <p className="text-xs opacity-50 font-medium">Visa, Mastercard, RuPay</p>
                                            </div>
                                            {method === 'card' && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white">✓</div>}
                                        </button>

                                        <button
                                            onClick={() => setMethod('upi')}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${method === 'upi' ? 'border-blue-500 bg-blue-500/5' : 'border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${method === 'upi' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-white/5 opacity-50'
                                                }`}>
                                                📱
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-black text-sm">UPI Payment</p>
                                                <p className="text-xs opacity-50 font-medium">PhonePe, GPay, Paytm</p>
                                            </div>
                                            {method === 'upi' && <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white">✓</div>}
                                        </button>
                                    </div>

                                    <button
                                        onClick={handlePay}
                                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <span>Proceed to Pay</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )}

                            {step === 'processing' && (
                                <div className="py-12 flex flex-col items-center justify-center space-y-6">
                                    <div className="relative">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="w-24 h-24 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-blue-200 border-l-transparent"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                                            <ShieldCheck size={32} />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-xl font-black mb-1">Securely Processing</h4>
                                        <p className="text-sm opacity-50 font-medium">Please do not close this window or refresh the page.</p>
                                    </div>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="py-12 flex flex-col items-center justify-center space-y-6">
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center text-white shadow-2xl shadow-green-500/25"
                                    >
                                        <CheckCircle2 size={48} />
                                    </motion.div>
                                    <div className="text-center">
                                        <h4 className="text-xl font-black mb-1">Payment Successful!</h4>
                                        <p className="text-sm opacity-50 font-medium">Your health is our priority. Order confirmed.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-white/5 flex items-center justify-center gap-4 grayscale opacity-40">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/RuPay.svg" alt="Rupay" className="h-4" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4" />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const ArrowRight = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
);

export default MockPaymentModal;
