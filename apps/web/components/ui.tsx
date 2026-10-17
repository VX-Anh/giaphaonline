'use client';

import { useId } from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-gold-soft text-ink border border-gold/40 hover:bg-gold/20',
    ghost: 'text-primary hover:bg-gold-soft',
    danger: 'bg-white text-danger border border-danger/40 hover:bg-danger/5',
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-xl border border-line bg-card p-5 shadow-sm ${className}`} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink placeholder:text-muted/70 focus:border-gold';

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-danger">
      {message}
    </p>
  );
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'gold' | 'warn' }) {
  const styles = {
    default: 'bg-line/60 text-ink',
    gold: 'bg-gold-soft text-ink border border-gold/40',
    warn: 'bg-amber-100 text-amber-900 border border-amber-300',
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm ${styles}`}>{children}</span>;
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-3xl font-bold text-primary">{children}</h1>
      {sub && <div className="mt-1 text-muted">{sub}</div>}
    </div>
  );
}
