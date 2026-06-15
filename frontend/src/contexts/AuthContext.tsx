import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../lib/api';
import type { UserInfo } from '../types';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string, storeId?: number) => Promise<void>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/verify')
        .then(({ data }) => setUser(data.data))
        .catch(() => { sessionStorage.clear(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string, storeId?: number) => {
    const { data } = await api.post('/auth/login', { username, password, ...(storeId ? { storeId } : {}) });
    const resp = data.data;
    sessionStorage.setItem('accessToken', resp.accessToken);
    sessionStorage.setItem('refreshToken', resp.refreshToken);
    setUser(resp.user);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (perm: string) => user?.permissions?.includes(perm) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
