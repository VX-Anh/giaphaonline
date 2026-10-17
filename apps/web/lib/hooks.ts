'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';
import { useAuth } from './auth';

/** Chuyển về trang đăng nhập nếu chưa đăng nhập. */
export function useRequireAuth() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);
  return ready && !!user;
}

/** Tải dữ liệu từ API, có hàm reload. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
