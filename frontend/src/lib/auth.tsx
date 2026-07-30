'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore, apiPost } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, twoFactorToken?: string) => Promise<{ twoFactorRequired?: boolean }>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

interface RegisterPayload {
  email: string; phone: string; password: string; firstName: string; lastName: string; role: 'BUYER' | 'SELLER';
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (tokenStore.access) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.data.user);
        } catch {
          tokenStore.clear();
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string, twoFactorToken?: string) {
    const res = await apiPost<any>('/auth/login', { email, password, twoFactorToken });
    if (res.twoFactorRequired) return { twoFactorRequired: true };
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
    return {};
  }

  async function register(payload: RegisterPayload) {
    const res = await apiPost<any>('/auth/register', payload);
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
  }

  function logout() {
    apiPost('/auth/logout', { refreshToken: tokenStore.refresh }).catch(() => {});
    tokenStore.clear();
    setUser(null);
    window.location.href = '/login';
  }

  async function refreshUser() {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
