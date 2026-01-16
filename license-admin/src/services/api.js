/**
 * LICITANTE PRIME - License Admin
 * Serviço de API
 */

import axios from 'axios';

// URL base da API (configurar no deploy)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================

export const login = async (username, password) => {
  const response = await api.post('/api/admin/login', { username, password });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.post('/api/admin/change-password', { currentPassword, newPassword });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/api/admin/me');
  return response.data;
};

// ==================== DASHBOARD ====================

export const getStats = async () => {
  const response = await api.get('/api/admin/stats');
  return response.data;
};

// ==================== LICENSES ====================

export const getLicenses = async (params = {}) => {
  const response = await api.get('/api/admin/licenses', { params });
  return response.data;
};

export const getLicense = async (id) => {
  const response = await api.get(`/api/admin/licenses/${id}`);
  return response.data;
};

export const createLicense = async (data) => {
  const response = await api.post('/api/admin/licenses', data);
  return response.data;
};

export const updateLicense = async (id, data) => {
  const response = await api.put(`/api/admin/licenses/${id}`, data);
  return response.data;
};

export const deleteLicense = async (id) => {
  const response = await api.delete(`/api/admin/licenses/${id}`);
  return response.data;
};

export const blockLicense = async (id, reason) => {
  const response = await api.post(`/api/admin/licenses/${id}/block`, { reason });
  return response.data;
};

export const unblockLicense = async (id) => {
  const response = await api.post(`/api/admin/licenses/${id}/unblock`);
  return response.data;
};

export const resetHardware = async (id) => {
  const response = await api.post(`/api/admin/licenses/${id}/reset-hardware`);
  return response.data;
};

// ==================== PLANS ====================

export const getPlans = async () => {
  const response = await api.get('/api/admin/plans');
  return response.data;
};

export default api;
