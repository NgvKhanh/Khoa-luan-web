import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/axios';
import { clearToken, getToken, setToken } from '../lib/token';
import type { User } from '../types/auth';

interface AuthResponse {
  success: boolean;
  data: { user: User; token: string };
}

interface MeResponse {
  success: boolean;
  data: { user: User };
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCurrentUser() {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get<MeResponse>('/auth/me');
        setUser(res.data.data.user);
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api.post<AuthResponse>('/auth/google', { idToken });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<AuthResponse>('/auth/register', {
        name,
        email,
        password,
      });
      setToken(res.data.data.token);
      setUser(res.data.data.user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, loginWithGoogle, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phai duoc dung ben trong AuthProvider');
  }
  return context;
}
