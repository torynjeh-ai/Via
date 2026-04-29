import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://192.168.1.124:3000';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { message: 'Network error' })
);

export default api;
