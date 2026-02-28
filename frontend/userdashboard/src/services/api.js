import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
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



export default api;
