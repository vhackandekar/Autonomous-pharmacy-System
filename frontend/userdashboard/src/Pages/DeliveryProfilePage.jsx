import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, CreditCard, User, Phone, Home, Building2,
  Check, Edit3, ShieldCheck, Truck, Wallet, Landmark
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Button, Badge } from '../Component/UI';

const DeliveryProfilePage = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    pin: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await authAPI.getProfile();
        setForm(prev => ({
          ...prev,
          name: data.name || '',
          phone: data.phone || '',
          address1: data.address1 || '',
          address2: data.address2 || '',
          city: data.city || '',
          state: data.state || '',
          pin: data.pin || ''
        }));
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, []);

  const cardBase = `rounded-2xl p-6 border ${theme === 'dark' ? 'bg-white/3 border-white/8' : 'bg-white border-slate-100 shadow-sm'}`;
  const inputBase = `w-full rounded-xl px-4 py-3 text-sm font-medium border outline-none transition-all focus:ring-2 ${theme === 'dark'
    ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-brand-primary/30 focus:border-brand-primary/50'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-brand-primary/20 focus:border-brand-primary/50'
    }`;

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const validateForm = () => {
    const nameRegex = /^[A-Za-z\s]{2,}$/;
    const phoneRegex = /^\d{10}$/;
    const pinRegex = /^\d{6}$/;

    if (!nameRegex.test(form.name.trim())) {
      alert("Name must be at least 2 characters long and contain only letters.");
      return false;
    }
    if (!phoneRegex.test(form.phone.trim())) {
      alert("Phone number must be exactly 10 digits.");
      return false;
    }
    if (!form.address1.trim()) {
      alert("Address Line 1 is required.");
      return false;
    }
    if (!form.city.trim()) {
      alert("City is required.");
      return false;
    }
    if (!form.state.trim()) {
      alert("State is required.");
      return false;
    }
    if (!pinRegex.test(form.pin.trim())) {
      alert("PIN Code must be exactly 6 digits.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      await authAPI.updateProfile({
        ...form
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert(error.response?.data?.error || "Failed to update profile.");
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center space-x-3 mb-1">
          <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-brand-primary/15 text-brand-primary' : 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'}`}>
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-3xl font-black tracking-tight">Dispatch Profile</h2>
        </div>
        <p className="text-sm opacity-50 font-medium ml-14">Orders placed via AI Chat ship here automatically.</p>
      </motion.div>

      <div className="space-y-6">
        {/* Personal Details */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={cardBase}>
          <div className="flex items-center space-x-2 mb-5">
            <User size={16} className="text-brand-primary" />
            <h3 className="font-black text-sm uppercase tracking-widest opacity-70">Personal Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Full Name</label>
              <input className={inputBase} placeholder="Alex Johnson" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Phone Number</label>
              <input className={inputBase} placeholder="+91 98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
        </motion.div>

        {/* Shipping Address */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cardBase}>
          <div className="flex items-center space-x-2 mb-5">
            <MapPin size={16} className="text-brand-primary" />
            <h3 className="font-black text-sm uppercase tracking-widest opacity-70">Shipping Address</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Address Line 1</label>
              <input className={inputBase} placeholder="Flat / House No., Street" value={form.address1} onChange={e => set('address1', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Address Line 2 (Optional)</label>
              <input className={inputBase} placeholder="Landmark, Area" value={form.address2} onChange={e => set('address2', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">City</label>
                <input className={inputBase} placeholder="Mumbai" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">State</label>
                <input className={inputBase} placeholder="Maharashtra" value={form.state} onChange={e => set('state', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">PIN Code</label>
                <input className={inputBase} placeholder="400001" value={form.pin} onChange={e => set('pin', e.target.value)} />
              </div>
            </div>
          </div>
        </motion.div>


        {/* Save Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSave}
          >
            {saved ? (
              <><Check size={18} className="mr-2" /> Profile Saved!</>
            ) : (
              <><ShieldCheck size={18} className="mr-2" /> Save Dispatch Profile</>
            )}
          </Button>
          <p className="text-center text-[10px] opacity-30 font-black uppercase tracking-widest mt-4">
            Your details are stored locally and never shared.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryProfilePage;
