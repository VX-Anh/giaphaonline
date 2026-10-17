'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const handle = useCallback(async (p: Promise<{ accessToken: string; user: User }>) => {
    const res = await p;
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const value: AuthState = {
    user,
    ready,
    login: (email, password) => handle(api('/auth/login', { method: 'POST', body: { email, password } })),
    register: (email, password, fullName) =>
      handle(api('/auth/register', { method: 'POST', body: { email, password, fullName } })),
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
