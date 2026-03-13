import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Calendar, RefreshCcw, CheckCircle2,
  XCircle, Filter, Search, FileText, Download,
  MoreVertical, ArrowRight
} from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { useChat } from '../context/ChatContext';
import { Card, Badge, Button, Dropdown } from '../Component/UI';

const HistoryPage = () => {
  const { orders, loading } = useOrders();
  const { addMessageToActive } = useChat();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const handleReorder = (medicineName) => {
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: medicineName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    addMessageToActive(userMsg);
    navigate('/chat');
  };

  const getStatusVariant = (status) => {
    switch (status.toUpperCase()) {
      case 'FULFILLED': return 'success';
      case 'CANCELLED': return 'error';
      case 'REJECTED': return 'error';
      case 'DELIVERED': return 'success';
      default: return 'info';
    }
  };

  const filteredOrders = orders.filter(order => {
    const status = order.status.toUpperCase();
    // History includes past orders. Active orders are in MyOrders, 
    // but the user expects History to show everything or at least delivered/cancelled.
    // Let's make History show EVERYTHING but default filter to show relevant history.

    // Status Filter
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'DELIVERED' && (status === 'FULFILLED' || status === 'DELIVERED')) ||
      (filter === 'CANCELLED' && status === 'CANCELLED');

    if (!matchesFilter) return false;

    // Search Filter
    const searchLower = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchLower) ||
      order.fullId.toLowerCase().includes(searchLower) ||
      order.name.toLowerCase().includes(searchLower)
    );
  });

  const filterOptions = [
    { id: 'ALL', label: 'All Orders', icon: <Package size={14} /> },
    { id: 'DELIVERED', label: 'Delivered', icon: <CheckCircle2 size={14} /> },
    { id: 'CANCELLED', label: 'Cancelled', icon: <XCircle size={14} /> },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col space-y-3 border-b-2 border-brand-primary/10 pb-8">
        <h2 className="text-4xl font-black tracking-tight text-black dark:text-white">Order History</h2>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by Order ID or Medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-white/5 border-2 border-black/5 dark:border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/10 transition-all text-black dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl w-full lg:w-auto">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`flex-1 lg:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all ${filter === opt.id
                ? 'bg-white dark:bg-white/10 shadow-lg text-brand-primary dark:text-white'
                : 'text-black dark:text-white opacity-40 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-white/5 rounded-2xl">
        <div className="overflow-x-auto text-black dark:text-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/10">
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Order ID</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Medicine</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Date</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Quantity</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Status</th>
                <th className="px-6 py-5 text-right text-[11px] font-black uppercase tracking-[0.15em] opacity-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              <AnimatePresence mode='popLayout'>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <motion.tr
                      key={order.fullId || order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group transition-colors hover:bg-slate-50/30 dark:hover:bg-white/[0.01]"
                    >
                      <td className="px-6 py-5">
                        <span className="font-black text-xs tracking-wider">
                          <span className="opacity-20 font-medium mr-1 text-[10px]">#</span>
                          {order.id.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="w-9 h-9 rounded-lg bg-brand-background dark:bg-white/5 flex items-center justify-center text-base shadow-sm border border-slate-100 dark:border-white/10">
                            {order.image}
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-tight tracking-tight">{order.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{order.dosage}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                          <Calendar size={13} className="opacity-50" />
                          <span className="whitespace-nowrap">{order.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold text-xs">
                          {order.qty} <span className="text-[10px] uppercase opacity-30 ml-1">Units</span>
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={getStatusVariant(order.status)} className="scale-90 origin-left">
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end space-x-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 px-4 text-[9px] uppercase font-black tracking-widest bg-brand-primary/5 hover:bg-brand-primary hover:text-white transition-all border-none"
                            onClick={() => handleReorder(order.name)}
                          >
                            <RefreshCcw size={10} className="mr-2" />
                            Reorder
                          </Button>
                          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 group-hover:text-brand-primary transition-all">
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                        <Package size={56} />
                        <p className="text-sm font-black uppercase tracking-widest">No matching history found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default HistoryPage;

