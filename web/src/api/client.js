import axios from 'axios';

// Requests go to /api — proxied to backend by nginx in production, by Vite in dev
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const data = err.response?.data;
    // Redirect to identity verification if the backend blocks an unverified user
    if (data?.code === 'PROFILE_INCOMPLETE') {
      window.location.href = '/setup-profile';
      return Promise.reject(data);
    }
    return Promise.reject(data || { message: 'Network error' });
  }
);

export default api;
