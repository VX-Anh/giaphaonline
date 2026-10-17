'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, ErrorBox, Field, inputClass, PageTitle } from '@/components/ui';
import { api, errorText, Family, ROLE_LABEL } from '@/lib/api';
import { useApi, useRequireAuth } from '@/lib/hooks';

export default function FamiliesPage() {
  const authed = useRequireAuth();
  const { data: families, error, reload } = useApi<Family[]>(authed ? '/families' : null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', surname: '', originPlace: '' });
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api('/families', { method: 'POST', body: { ...form, originPlace: form.originPlace || null } });
      setForm({ name: '', surname: '', originPlace: '' });
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  }

  if (!authed) return null;

  return (
    <>
      <PageTitle sub="Các gia phả bạn quản lý hoặc được mời tham gia">Dòng họ của tôi</PageTitle>
      <ErrorBox message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        {families?.map((f) => (
          <Link key={f.id} href={`/families/${f.id}`} className="block">
            <Card className="h-full transition hover:border-gold">
              <h2 className="font-serif text-xl font-bold text-primary">{f.name}</h2>
              <p className="text-muted">{f.originPlace ?? 'Chưa ghi nguyên quán'}</p>
              <div className="mt-3 flex gap-2">
                <Badge tone="gold">{ROLE_LABEL[f.role]}</Badge>
                <Badge>{f.personCount ?? 0} người</Badge>
              </div>
            </Card>
          </Link>
        ))}
        {families && !families.length && !creating && (
          <Card className="sm:col-span-2 text-center text-muted">Bạn chưa có gia phả nào. Hãy tạo gia phả đầu tiên cho dòng họ.</Card>
        )}
      </div>

      <div className="mt-6">
        {creating ? (
          <Card>
            <h2 className="mb-4 font-serif text-xl font-bold">Tạo gia phả mới</h2>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên gia phả" hint="Ví dụ: Họ Nguyễn Văn - chi Đông Ngạc">
                {(id) => <input id={id} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
              </Field>
              <Field label="Họ">
                {(id) => <input id={id} className={inputClass} value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required />}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Nguyên quán">
                  {(id) => <input id={id} className={inputClass} value={form.originPlace} onChange={(e) => setForm({ ...form, originPlace: e.target.value })} />}
                </Field>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-3">
                <ErrorBox message={formError} />
                <div className="flex gap-3">
                  <Button type="submit">Tạo gia phả</Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                    Hủy
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)}>+ Tạo gia phả mới</Button>
        )}
      </div>
    </>
  );
}
