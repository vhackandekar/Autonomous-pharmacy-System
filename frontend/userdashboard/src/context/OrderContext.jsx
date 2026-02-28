import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { orderAPI, cartAPI, notificationAPI } from '../services/api';

const OrderContext = createContext();

export const useOrders = () => useContext(OrderContext);

export const OrderProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  // 1. Fetch orders history from backend
  const fetchOrders = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await orderAPI.getHistory(user.id);
      const formattedOrders = data.map(order => ({
        id: order._id.substring(order._id.length - 6),
        fullId: order._id,
        name: order.items.map(i => i.medicineId?.name || "Medicine").join(", "),
        dosage: order.items[0]?.dosagePerDay || "As directed",
        qty: order.items.reduce((sum, i) => sum + i.quantity, 0),
        price: order.totalAmount,
        status: order.status, // Keep original status for logic, format in UI if needed
        date: new Date(order.orderDate).toLocaleDateString(),
        estimate: order.estimatedEndDate ? new Date(order.estimatedEndDate).toLocaleDateString() : 'Processing',
        image: '💊'
      }));
      setOrders(formattedOrders);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await orderAPI.cancelOrder(orderId);
      await fetchOrders();
      alert("Order cancelled successfully");
    } catch (error) {
      console.error("Failed to cancel order:", error);
      alert("Failed to cancel order");
    }
  };

  // 2. Sync Cart with Backend
  const fetchCart = async () => {
    if (!user?.id) return;
    try {
      const { data } = await cartAPI.get();
      if (data && data.items) {
        const mappedCart = data.items.map(item => ({
          id: item.medicineId._id,
          dbId: item._id,
          name: item.medicineId.name,
          price: item.medicineId.price,
          qty: item.quantity,
          dosage: item.medicineId.description || item.medicineId.dosage || 'Pharmacist pick',
          prescriptionRequired: item.medicineId.prescriptionRequired,
          prescriptionStatus: item.prescriptionStatus,
          image: '💊' // In future, use item.medicineId.image
        }));
        setCart(mappedCart);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    }
  };

  // 3. Fetch Notifications
  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const { data } = await notificationAPI.getUserNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.warn("Failed to fetch notifications:", error);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead(user.id, user.role);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  useEffect(() => {
    let interval;
    if (user?.id) {
      fetchOrders();
      fetchCart();
      fetchNotifications();

      // Poll for new notifications every 10 seconds to keep UI "Real-time"
      interval = setInterval(() => {
        fetchNotifications();
      }, 10000);
    } else {
      setOrders([]);
      setCart([]);
      setNotifications([]);
    }
    return () => clearInterval(interval);
  }, [user]);

  const [stats, setStats] = useState({
    activeOrders: 0,
    pendingReview: 0,
    newMessages: 0,
    rewardPoints: 0
  });

  useEffect(() => {
    const active = orders.filter(o => ['Confirmed', 'Processing', 'Shipped', 'Placed'].includes(o.status)).length;
    setStats(prev => ({
      ...prev,
      activeOrders: active,
      newMessages: notifications.filter(n => !n.isRead).length
    }));
  }, [orders, notifications]);

  const placeOrder = async (orderData) => {
    try {
      const response = await orderAPI.place({
        userId: user.id,
        items: Array.isArray(orderData.items) ? orderData.items : [{
          medicineId: orderData.medicineId || orderData.id,
          quantity: orderData.qty || 1,
          dosagePerDay: orderData.dosage || 'Standard'
        }],
        totalAmount: orderData.price * (orderData.qty || 1)
      });
      fetchOrders();
      return response.data;
    } catch (error) {
      console.error("Failed to place order:", error);
      throw error;
    }
  };

  const reorder = (orderId) => {
    const orderToReorder = orders.find(o => o.id === orderId);
    if (orderToReorder) placeOrder(orderToReorder);
  };

  const addToCart = async (medicine) => {
    try {
      await cartAPI.add({
        userId: user.id,
        medicineId: medicine.id,
        quantity: medicine.qty || 1
      });
      fetchCart();
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to add to cart";
      alert(msg);
      console.error("Add to cart error:", error);
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      await cartAPI.remove(itemId);
      fetchCart();
    } catch (error) {
      console.error("Failed to remove from cart:", error);
    }
  };

  const updateCartQty = async (itemId, qty) => {
    if (qty < 1) {
      removeFromCart(itemId);
      return;
    }
    try {
      const { data: cartData } = await cartAPI.get();
      await cartAPI.update({
        cartId: cartData._id,
        medicineId: itemId,
        quantity: qty
      });
      fetchCart();
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to update quantity";
      alert(msg);
      console.error("Update qty error:", error);
    }
  };

  const placeCartOrder = async () => {
    try {
      setLoading(true);
      const { data: cartData } = await cartAPI.get();
      const orderData = {
        userId: user.id,
        cartId: cartData._id,
        items: cart.map(item => ({
          medicineId: item.id,
          quantity: item.qty,
          dosagePerDay: item.dosage
        })),
        totalAmount: cart.reduce((sum, item) => sum + item.price * item.qty, 0)
      };
      await orderAPI.place(orderData);

      // Refresh Cart, Orders, and Notifications if the AI performed an action
      fetchCart();
      fetchOrders();
      fetchNotifications();
      alert("Order placed successfully!");

    } catch (error) {
      const msg = error.response?.data?.error || "Failed to initiate order";
      alert(msg);
      console.error("Place order init error:", error);
    } finally {
      setLoading(false);
    }
  };



  const clearCart = async () => {
    try {
      const { data: cartData } = await cartAPI.get();
      if (cartData._id) {
        await cartAPI.clear(cartData._id);
        fetchCart();
      }
    } catch (error) {
      console.error("Failed to clear cart:", error);
    }
  };

  return (
    <OrderContext.Provider value={{
      orders, cart, stats, notifications, loading,
      placeOrder, reorder, cancelOrder,
      addToCart, removeFromCart, updateCartQty, placeCartOrder, clearCart,
      fetchOrders, fetchCart, fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead
    }}>
      {children}
    </OrderContext.Provider>
  );
};
