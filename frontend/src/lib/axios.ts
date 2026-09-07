import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_URL) {
  throw new Error(
    'Thieu bien moi truong VITE_API_URL. Hay tao file .env tu .env.example.'
  );
}

export const api = axios.create({
  baseURL: API_URL,
  // Gui va nhan cookie httpOnly (chua JWT) cho moi request
  withCredentials: true,
});

// Cac trang cong khai (chua dang nhap van xem duoc) - khong da ve /login khi 401
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

// Neu server tra ve 401 (het han / khong hop le), dua ve trang dang nhap
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (!PUBLIC_PATHS.includes(path)) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);
