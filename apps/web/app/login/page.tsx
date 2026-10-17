'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, ErrorBox, Field, inputClass } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, fullName);
      router.push('/families');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-4 font-serif text-2xl font-bold text-primary">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'register' && (
          <Field label="Họ và tên">
            {(id) => <input id={id} className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />}
          </Field>
        )}
        <Field label="Email">
          {(id) => <input id={id} type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}
        </Field>
        <Field label="Mật khẩu" hint={mode === 'register' ? 'Tối thiểu 8 ký tự' : undefined}>
          {(id) => (
            <input
              id={id}
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          )}
        </Field>
        <ErrorBox message={error} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </Button>
      </form>
      <p className="mt-4 text-center text-muted">
        {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
        <button className="font-medium text-primary underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
        </button>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
