'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b-4 border-gold bg-primary text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? '/families' : '/'} className="font-serif text-2xl font-bold tracking-wide">
          Gia Phả Online
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{user.fullName}</span>
            <button onClick={logout} className="min-h-11 rounded-lg px-3 underline-offset-4 hover:underline">
              Đăng xuất
            </button>
          </div>
        ) : (
          <Link href="/login" className="min-h-11 rounded-lg px-3 py-2 hover:underline">
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
