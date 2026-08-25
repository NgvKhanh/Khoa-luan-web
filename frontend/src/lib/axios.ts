import axios from 'axios';
import { clearToken, getToken } from './token';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_URL) {
  throw new Error(
    'Thieu bien moi truong VITE_API_URL. Hay tao file .env tu .env.example.'
  );
}

export const api = axios.create({
  baseURL: API_URL,
});

// Tu dong gan token vao header Authorization cho moi request neu da dang nhap
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Neu server tra ve 401 (het han / khong hop le), xoa token va dua ve trang dang nhap
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);
