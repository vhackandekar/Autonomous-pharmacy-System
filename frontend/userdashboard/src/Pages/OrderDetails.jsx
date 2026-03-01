import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Truck, CheckCircle2,
  MapPin, CreditCard, Clock, AlertCircle,
  FileText, ShieldCheck
} from 'lucide-react';
import { orderAPI } from '../services/api';
import { Card, Badge, Button } from '../Component/UI';

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const { data } = await orderAPI.getOrderDetails(orderId);
        setOrder(data);
      } catch (error) {
        console.error("Failed to fetch order details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [orderId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
    </div>
  );

  if (!order) return (
    <div className="p-8 text-center">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <h2 className="text-2xl font-bold">Order not found</h2>
      <Button onClick={() => navigate('/orders')} className="mt-4">Back to My Orders</Button>
    </div>
  );

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

  const steps = [
    { id: 'PENDING', icon: <Package size={18} />, label: 'Order Placed' },
    { id: 'PROCESSING', icon: <ShieldCheck size={18} />, label: 'Processing' },
    { id: 'SHIPPED', icon: <Truck size={18} />, label: 'Shipped' },
    { id: 'DELIVERED', icon: <CheckCircle2 size={18} />, label: 'Delivered' }
  ];

  const currentStepIndex = steps.findIndex(step =>
    step.id === order.status.toUpperCase() ||
    (order.status.toUpperCase() === 'PLACED' && step.id === 'PENDING') ||
    (order.status.toUpperCase() === 'CONFIRMED' && step.id === 'PROCESSING') ||
    (order.status.toUpperCase() === 'IN_WAREHOUSE' && step.id === 'PROCESSING') ||
    (order.status.toUpperCase() === 'FULFILLED' && step.id === 'DELIVERED')
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-sm font-bold opacity-60 hover:opacity-100 transition-all mb-8"
      >
        <ArrowLeft size={16} />
        <span>Back to Orders</span>
      </motion.button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Order Info */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-black tracking-tight text-black dark:text-white">Order #{order._id.slice(-6).toUpperCase()}</h1>
              <Badge variant={getStatusVariant(order.status)}>
                {order.status}
              </Badge>
            </div>
            <p className="text-sm opacity-60 dark:opacity-80 font-medium text-black dark:text-white/80">Placed on {new Date(order.orderDate).toLocaleDateString()} at {new Date(order.orderDate).toLocaleTimeString()}</p>
          </motion.div>

          {/* Status Timeline */}
          {order.status !== 'Cancelled' && (
            <Card className="p-8">
              <div className="relative flex justify-between">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-black/5 -translate-y-1/2 z-0" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-brand-primary -translate-y-1/2 transition-all duration-1000 z-0"
                  style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                />
                {steps.map((step, idx) => {
                  const isActive = idx <= currentStepIndex;
                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-brand-primary text-white shadow-lg' : 'bg-white dark:bg-white/5 text-black/20 dark:text-white/20 border-2 border-dashed border-black/10 dark:border-white/10'
                        }`}>
                        {step.icon}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-tighter mt-3 ${isActive ? 'text-brand-primary' : 'opacity-20 dark:opacity-40 text-black dark:text-white'
                        }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Items List */}
          <Card className="overflow-hidden bg-white dark:bg-white/5 border-2 border-black/5 dark:border-white/10">
            <div className="bg-black/5 dark:bg-white/5 p-4 border-b border-black/5 dark:border-white/10">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-black dark:text-white">
                <FileText size={16} className="text-brand-primary" />
                Order Items
              </h3>
            </div>
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-6 flex items-center justify-between group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-background dark:bg-brand-primary/10 flex items-center justify-center text-xl shadow-inner border border-black/5 dark:border-white/5">
                      💊
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-black dark:text-white">{item.medicineId?.name || 'Unknown Medicine'}</h4>
                      <p className="text-xs opacity-40 dark:opacity-60 font-bold uppercase tracking-widest text-black dark:text-white">Qty: {item.quantity} units • {item.dosagePerDay}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-brand-primary">₹{(item.medicineId?.price * item.quantity).toFixed(2)}</p>
                    <p className="text-[10px] opacity-40 dark:opacity-60 font-bold text-black dark:text-white">₹{item.medicineId?.price} / unit</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Summaries */}
        <div className="space-y-6">
          <div className="p-6 bg-brand-primary text-white rounded-[2rem] border-none shadow-brand-primary/20 relative overflow-hidden">
            {/* Decorative pill for professional look */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

            <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-b border-white/20 pb-4 relative z-10">Payment Summary</h3>
            <div className="space-y-3 relative z-10">
              <div className="flex justify-between text-sm">
                <span className="opacity-70 font-bold text-[10px] uppercase tracking-widest">Subtotal</span>
                <span className="font-black">₹{order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70 font-bold text-[10px] uppercase tracking-widest">Shipping</span>
                <span className="font-black">FREE</span>
              </div>
              <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                <span className="font-black text-sm uppercase opacity-70">Payable Total</span>
                <span className="font-black text-3xl">₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/20 flex items-center space-x-3 opacity-90 relative z-10">
              <CreditCard size={20} />
              <div>
                <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">Payment Status</p>
                <p className="text-sm font-black tracking-tight uppercase">{order.paymentStatus}</p>
              </div>
            </div>
          </div>

          <Card className="p-6 bg-white dark:bg-white/5 border-2 border-black/5 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-b border-black/5 dark:border-white/10 pb-4 text-black dark:text-white">Delivery & Contact</h3>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-brand-background dark:bg-brand-primary/10 rounded-lg text-brand-primary">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:opacity-60 mb-1 text-black dark:text-white">Shipping Address</p>
                  <p className="text-sm font-bold leading-relaxed text-black dark:text-white/90">
                    {order.userId && order.userId.address1 ? (
                      <div className="space-y-1.5 grayscale-0 group-hover:grayscale-0 transition-all">
                        <div className="font-black text-[10px] uppercase tracking-[0.1em] text-brand-primary">
                          {order.userId.name}
                        </div>
                        <div className="text-[11px] opacity-70 font-medium tracking-tight">
                          {order.userId.phone}
                        </div>
                        <div className="mt-1 text-xs opacity-90 leading-relaxed font-bold">
                          {[
                            order.userId.address1,
                            order.userId.address2,
                            order.userId.city,
                            order.userId.state,
                            order.userId.pin
                          ].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    ) : (
                      'No address provided'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-brand-background dark:bg-brand-primary/10 rounded-lg text-brand-primary">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:opacity-60 mb-1 text-black dark:text-white">Expected Delivery</p>
                  <p className="text-sm font-bold leading-relaxed text-black dark:text-white/90">
                    {order.estimatedEndDate ? new Date(order.estimatedEndDate).toLocaleDateString() : 'Processing soon'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Button variant="secondary" className="w-full flex items-center justify-center gap-2 py-4">
            <FileText size={18} />
            Download Invoice
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
