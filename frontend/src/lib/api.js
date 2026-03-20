import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password, role) => api.post('/auth/register', { username, password, role }),
  me: () => api.get('/auth/me'),
};

// Users
export const usersApi = {
  getDrivers: () => api.get('/users/drivers'),
};

// Inventory
export const inventoryApi = {
  getAll: () => api.get('/inventory'),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
};

// Orders
export const ordersApi = {
  getAll: (params) => api.get('/orders', { params }),
  getToday: () => api.get('/orders/today'),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};

// Payments
export const paymentsApi = {
  getAll: (params) => api.get('/payments', { params }),
  submit: (amount) => api.post('/payments', { amount }),
  approve: (id) => api.put(`/payments/${id}/approve`),
  reject: (id) => api.put(`/payments/${id}/reject`),
};

// Driver Hours
export const driverHoursApi = {
  getAll: (params) => api.get('/driver-hours', { params }),
  log: (date, hours) => api.post('/driver-hours', { date, hours }),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Audit Logs
export const auditLogsApi = {
  getAll: () => api.get('/audit-logs'),
};

// Stats
export const statsApi = {
  getBossStats: () => api.get('/stats/boss'),
  getDriverStats: (date) => api.get('/stats/driver', { params: { date } }),
};

// Seed
export const seedApi = {
  seed: () => api.post('/seed'),
};

export default api;
