import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Package, Truck, Calendar, Info, XCircle, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useOrders } from '../context/OrderContext';
import { Card, Badge, Button } from '../Component/UI';

const MyOrders = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { orders, cancelOrder } = useOrders();

  const getStatusVariant = (status) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'warning';
      case 'PROCESSING': return 'info';
      case 'CONFIRMED': return 'info';
      case 'PLACED': return 'warning';
      case 'IN_WAREHOUSE': return 'purple';
      case 'SHIPPED': return 'purple';
      case 'DELIVERED': return 'success';
      case 'FULFILLED': return 'success';
      case 'REJECTED': return 'error';
      case 'CANCELLED': return 'error';
      default: return 'info';
    }
  };

  const activeOrders = orders.filter(order =>
    ['Awaiting Payment', 'Placed', 'CONFIRMED', 'IN_WAREHOUSE', 'SHIPPED', 'PENDING', 'AWAITING_CONFIRMATION', 'PROCESSING'].includes(order.status.toUpperCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-b-2 border-brand-primary/10 pb-8">
        <div>
          <h2 className="text-4xl font-black tracking-tight mb-3 text-black dark:text-white">My Orders</h2>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-black uppercase tracking-widest border border-brand-primary/20">
              Active Tracking: {activeOrders.length}
            </div>
            <p className="text-xs opacity-50 font-bold">Real-time pharmacy logistics</p>
          </div>
        </div>
        {/* Removed Logs and New Request buttons as requested */}
      </div>

      <div className="space-y-4">
        {activeOrders.length > 0 ? (
          activeOrders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: 10 }}
              className="group"
            >
              <div className="bg-white dark:bg-white/5 rounded-2xl border-2 border-black/5 dark:border-white/10 p-5 flex flex-col md:flex-row items-center gap-6 group-hover:border-brand-primary/30 transition-all duration-300 shadow-sm hover:shadow-2xl hover:shadow-brand-primary/5 relative overflow-hidden">
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${order.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-brand-primary'
                  }`} />

                <div className="flex items-center gap-6 flex-1 w-full">
                  <div className="w-16 h-16 rounded-xl bg-brand-background dark:bg-brand-primary/10 flex items-center justify-center text-3xl shadow-inner border border-black/5 dark:border-white/5 shrink-0">
                    {order.image}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                    <div className="min-w-0">
                      <h4 className="font-black text-lg truncate group-hover:text-brand-primary transition-colors text-black dark:text-white">{order.name}</h4>
                      <p className="text-[10px] opacity-40 dark:opacity-60 font-bold uppercase tracking-widest mt-1">Batch ID: #{order.id}</p>
                    </div>

                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 dark:opacity-50 mb-1">Prescription</p>
                        <p className="text-xs font-black truncate max-w-[120px] text-black dark:text-white/90">{order.dosage}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 dark:opacity-50 mb-1">Units</p>
                        <p className="text-xs font-black text-black dark:text-white/90">{order.qty} Pack</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border-l border-dashed border-black/10 dark:border-white/10 pl-6">
                      <div className="p-2 bg-brand-primary/5 dark:bg-brand-primary/10 rounded-lg text-brand-primary">
                        <Truck size={14} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 dark:opacity-50">Status</p>
                        <Badge variant={getStatusVariant(order.status)} className="text-[9px] py-0 px-2 font-black uppercase mt-1">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-black/5 dark:border-white/10 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
                  <Button
                    variant="error"
                    size="sm"
                    className="flex-1 md:flex-none h-10 px-4 bg-transparent text-red-400 hover:text-red-500 hover:bg-red-50 font-black text-[9px] uppercase tracking-widest border-none transition-all"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to cancel this prescription?")) {
                        cancelOrder(order.fullId);
                      }
                    }}
                  >
                    <XCircle size={14} className="mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 md:flex-none h-10 px-6 bg-black/5 dark:bg-white/10 border-none font-black text-[9px] uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center shadow-sm dark:text-white"
                    onClick={() => navigate(`/orders/${order.fullId}`)}
                  >
                    Details
                    <ChevronRight size={14} className="ml-1.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-40 border-4 border-dashed border-black/5 dark:border-white/5 rounded-3xl text-center">
            <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Package size={32} className="opacity-20 dark:opacity-40" />
            </div>
            <h3 className="text-xl font-black mb-2 opacity-60 dark:opacity-80 text-black dark:text-white">No Active Deliveries</h3>
            <p className="text-sm opacity-40 dark:opacity-60 font-bold max-w-xs mx-auto text-black dark:text-white/70">Your pharmacy orders will appear here once they are placed.</p>
            <Button variant="primary" size="sm" className="mt-8" onClick={() => navigate('/chat')}>
              Order Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;

