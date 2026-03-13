import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle the standardized data envelope
api.interceptors.response.use(
  (response) => {
    // Unwrap the standardized envelope { success: true, data: { ... } }
    if (response.data && response.data.success && response.data.data) {
      const unwrapped = response.data.data;
      if (typeof unwrapped === 'object' && unwrapped !== null) {
        unwrapped.success = true;
        response.data = unwrapped;
      }
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
};

export const cartAPI = {
  get: () => api.get('/cart'),
  add: (item) => api.post('/cart/add', item),
  update: (item) => api.put('/cart/update', item),
  remove: (medicineId) => api.delete('/cart/remove', { data: { medicineId } }),
  clear: (cartId) => api.delete('/cart/clear', { data: { cartId } }),
};

export const notificationAPI = {
  getUserNotifications: (userId) => api.get(`/notify/user/${userId}`),
  markAsRead: (id) => api.put(`/notify/${id}/read`),
  markAllAsRead: (userId, role) => api.post('/notify/mark-all-read', { userId, role }),
};

export const agentAPI = {
  chat: (userMessage, history) => api.post('/agent/chat', { userMessage, history }),
  uploadPrescription: (formData) => api.post('/agent/chat/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const medicineAPI = {
  getAll: () => api.get('/medicine'),
};

export const orderAPI = {
  place: (orderData) => api.post('/order/place', orderData),
  getHistory: (userId) => api.get(`/order/history/${userId}`),
  cancelOrder: (orderId) => api.put(`/order/${orderId}/cancel`),
  getOrderDetails: (orderId) => api.get(`/order/${orderId}`),
};

export const prescriptionAPI = {
  upload: (formData) => api.post('/prescription/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMy: () => api.get('/prescription/my'),
  delete: (id) => api.delete(`/prescription/${id}`),
};



export const stockAlertAPI = {
  subscribe: (medicineId) => api.post('/stock-alert/subscribe', { medicineId }),
};

export default api;
