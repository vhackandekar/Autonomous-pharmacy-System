import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`📤 API Request: ${config.method.toUpperCase()} ${config.url} (with token)`);
  } else {
    console.warn(`⚠️ API Request: ${config.method.toUpperCase()} ${config.url} (NO TOKEN!)`);
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log(`✅ API Response: ${res.status} ${res.config.url}`);
    return res;
  },
  (err) => {
    const errorMsg = err.response?.data?.error || err.message;
    const status = err.response?.status || 'unknown';
    console.error(`❌ API Error: ${status} ${err.config?.url} - ${errorMsg}`);

    if (err.response?.status === 401) {
      console.warn('🔐 Unauthorized - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// AUTH
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getProfile = () => api.get('/auth/profile');

// DASHBOARD
export const getDashboardStats = () => api.get('/admin/dashboard');
export const getAnalytics = () => api.get('/admin/analytics');
export const getActivity = () => api.get('/admin/activity');
export const getInventoryDetails = () => api.get('/admin/inventory');

// MEDICINES
export const getMedicines = () => api.get('/medicine');
export const addMedicine = (data) => api.post('/medicine/add', data);
export const updateMedicine = (id, data) => api.put(`/medicine/update/${id}`, data);

// ORDERS
export const getAllOrders = () => api.get('/admin/orders');
export const updateOrderStatus = (id, status) => api.put(`/admin/orders/${id}`, { status });
export const getUserOrderHistory = (userId) => api.get(`/order/history/${userId}`);

// AGENT
export const chatWithAgent = (userMessage) => api.post('/agent/chat', { userMessage });
export const getAgentLogs = () => api.get('/agent/logs');

// NOTIFICATIONS
export const getNotifications = (userId) => api.get(`/notify/user/${userId}`);

// PRESCRIPTIONS
export const validatePrescription = (medicineId, userId) =>
  api.get('/prescription/validate', { params: { medicineId, userId } });
export const uploadPrescription = (file) => {
  const formData = new FormData();
  formData.append('prescription', file);
  return api.post('/prescription/upload', formData);
};

// PAYMENT
export const processPayment = (data) => api.post('/payment/process', data);

// CART
export const createCart = (userId) => api.post('/cart/create', { userId });
export const addToCart = (data) => api.post('/cart/add', data);

// WEBHOOK
export const triggerRefillAlert = (data) => api.post('/webhook/refill-alert', data);
export const triggerOrderWebhook = (data) => api.post('/webhook/order', data);

// VENDORS
export const getVendors = () => api.get('/vendor');
export const addVendor = (data) => api.post('/vendor/add', data);
export const updateVendor = (id, data) => api.put(`/vendor/update/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendor/${id}`);
export const getPurchaseOrders = () => api.get('/vendor/purchase');
export const createPurchaseOrder = (data) => api.post('/vendor/purchase/create', data);
export const cancelPurchaseOrder = (id) => api.put(`/vendor/purchase/cancel/${id}`);
export const getAIRestockDraft = () => api.get('/vendor/ai-restock-draft');

// REFILL REQUESTS
export const getRefillRequests = () => api.get('/refill-request');
export const createRefillRequest = (data) => api.post('/refill-request/create', data);
export const sendRefillToVendor = (requestId, vendorId) => api.post(`/refill-request/${requestId}/send`, { vendorId });

export default api;
