import axios from 'axios';

// In production, VITE_API_URL points to the hosted backend (e.g. https://via-backend.up.railway.app)
// In development, requests go to /api which is proxied to localhost:3000 by Vite
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { message: 'Network error' })
);

export default api;
