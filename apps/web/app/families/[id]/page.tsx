'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { MapView } from '@/components/MapView';
import { PersonForm } from '@/components/PersonForm';
import { PlaceForm } from '@/components/PlaceForm';
import { directionsUrl, FAMILY_KINDS, KIND_META, Place, PlaceKind } from '@/lib/places';
import { TreeData, TreeView } from '@/components/TreeView';
import { Badge, Button, Card, ErrorBox, Field, inputClass, PageTitle } from '@/components/ui';
import { api, canEdit, errorText, Family, isAdmin, PersonView, Role, ROLE_LABEL } from '@/lib/api';
import { useApi, useRequireAuth } from '@/lib/hooks';

const TABS = [
  ['people', 'Thành viên gia phả'],
  ['tree', 'Cây phả hệ'],
  ['map', 'Bản đồ'],
  ['anniversaries', 'Lịch giỗ'],
  ['history', 'Lịch sử thay đổi'],
  ['members', 'Người dùng & quyền'],
] as const;
type Tab = (typeof TABS)[number][0];

function FamilyPage() {
  const authed = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get('tab') as Tab) ?? 'people';
  const { data: family, error } = useApi<Family>(authed ? `/families/${id}` : null);

  if (!authed) return null;
  if (error) return <ErrorBox message={error} />;
  if (!family) return <p className="text-muted">Đang tải…</p>;

  const visibleTabs = TABS.filter(([t]) => t !== 'history' || canEdit(family.role));

  return (
    <>
      <PageTitle sub={<>{family.originPlace ?? 'Chưa ghi nguyên quán'} · <Badge tone="gold">{ROLE_LABEL[family.role]}</Badge></>}>
        {family.name}
      </PageTitle>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-line" aria-label="Mục gia phả">
        {visibleTabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => router.replace(`/families/${id}?tab=${t}`)}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px min-h-11 border-b-4 px-3 py-2 font-medium ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'people' && <PeopleTab family={family} />}
      {tab === 'tree' && <TreeTab family={family} />}
      {tab === 'map' && <MapTab family={family} />}
      {tab === 'anniversaries' && <AnniversariesTab family={family} />}
      {tab === 'history' && canEdit(family.role) && <HistoryTab family={family} />}
      {tab === 'members' && <MembersTab family={family} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <FamilyPage />
    </Suspense>
  );
}

function PeopleTab({ family }: { family: Family }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data: people, error, reload } = useApi<PersonView[]>(`/families/${family.id}/persons${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        role="search"
      >
        <label htmlFor="search" className="sr-only">Tìm theo tên</label>
        <input id="search" className={inputClass} placeholder="Tìm theo tên (gõ không dấu cũng được)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">Tìm</Button>
      </form>
      <ErrorBox message={error} />

      {canEdit(family.role) &&
        (adding ? (
          <Card>
            <h2 className="mb-4 font-serif text-xl font-bold">Thêm người vào gia phả</h2>
            <PersonForm familyId={family.id} onSaved={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
          </Card>
        ) : (
          <div><Button onClick={() => setAdding(true)}>+ Thêm người</Button></div>
        ))}

      <Card className="p-0">
        <table className="w-full text-left">
          <thead className="border-b border-line bg-gold-soft/60">
            <tr>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Đời</th>
              <th className="hidden px-4 py-3 sm:table-cell">Năm sinh – mất</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {people?.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  {p.masked ? (
                    <span className="italic text-muted">{p.displayName}</span>
                  ) : (
                    <Link href={`/families/${family.id}/persons/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.displayName}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">{!p.masked && p.generationRecorded}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{!p.masked && p.years}</td>
                <td className="px-4 py-3">
                  {!p.masked && p.basisStatus === 'unverified' ? (
                    <Badge tone="warn">Chưa xác minh</Badge>
                  ) : !p.masked && p.livingStatus === 'deceased' ? (
                    <Badge>Đã mất</Badge>
                  ) : (
                    <Badge tone="gold">Còn sống / chưa rõ</Badge>
                  )}
                </td>
              </tr>
            ))}
            {people && !people.length && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">{query ? 'Không tìm thấy ai.' : 'Chưa có người nào trong gia phả.'}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TreeTab({ family }: { family: Family }) {
  const { data: people } = useApi<PersonView[]>(`/families/${family.id}/persons`);
  const [rootId, setRootId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = (people ?? []).filter((p): p is Extract<PersonView, { masked: false }> => !p.masked);

  useEffect(() => {
    if (!rootId && candidates.length) {
      const sorted = [...candidates].sort((a, b) => (a.generationRecorded ?? 999) - (b.generationRecorded ?? 999));
      setRootId(sorted[0].id);
    }
  }, [candidates, rootId]);

  useEffect(() => {
    if (!rootId) return;
    api<TreeData>(`/families/${family.id}/tree/${rootId}`)
      .then((t) => { setTree(t); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [family.id, rootId]);

  if (people && !candidates.length) return <Card className="text-muted">Chưa có ai trong gia phả để vẽ cây.</Card>;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Bắt đầu cây từ">
        {(id) => (
          <select id={id} className={`${inputClass} max-w-md`} value={rootId ?? ''} onChange={(e) => setRootId(e.target.value)}>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.generationRecorded ? `Đời ${p.generationRecorded} - ` : ''}{p.displayName}
              </option>
            ))}
          </select>
        )}
      </Field>
      <ErrorBox message={error} />
      <Card>{tree ? <TreeView data={tree} familyId={family.id} /> : <p className="text-muted">Đang tải cây…</p>}</Card>
    </div>
  );
}

function MapTab({ family }: { family: Family }) {
  const { data: places, error, reload } = useApi<Place[]>(`/families/${family.id}/places`);
  const [kinds, setKinds] = useState<Set<PlaceKind>>(new Set(Object.keys(KIND_META) as PlaceKind[]));
  const [generation, setGeneration] = useState<string>('');
  const [focus, setFocus] = useState<{ id: string; seq: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = places ?? [];
  const generations = [...new Set(all.map((p) => p.person?.generationRecorded).filter((g): g is number => g != null))].sort((a, b) => a - b);
  const shown = all.filter(
    (p) => kinds.has(p.kind) && (!generation || (generation === 'family' ? !p.person : p.person?.generationRecorded === Number(generation))),
  );
  const toggleKind = (k: PlaceKind) =>
    setKinds((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  async function remove(p: Place) {
    setActionError(null);
    try {
      await api(`/families/${family.id}/places/${p.id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBox message={error ?? actionError} />
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Lọc loại địa điểm</legend>
        {(Object.keys(KIND_META) as PlaceKind[]).map((k) => (
          <label
            key={k}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 ${kinds.has(k) ? 'border-transparent text-white' : 'border-line bg-white text-muted'}`}
            style={kinds.has(k) ? { background: KIND_META[k].color } : undefined}
          >
            <input type="checkbox" className="sr-only" checked={kinds.has(k)} onChange={() => toggleKind(k)} />
            {KIND_META[k].label}
            <span className="text-sm opacity-80">({all.filter((p) => p.kind === k).length})</span>
          </label>
        ))}
        <label className="ml-auto flex items-center gap-2">
          <span className="text-muted">Đời</span>
          <select className={`${inputClass} w-auto`} value={generation} onChange={(e) => setGeneration(e.target.value)}>
            <option value="">Tất cả</option>
            {generations.map((g) => <option key={g} value={g}>Đời {g}</option>)}
            <option value="family">Địa điểm chung của họ</option>
          </select>
        </label>
      </fieldset>

      {adding ? (
        <Card>
          <h2 className="mb-3 font-serif text-xl font-bold">Thêm nhà thờ họ / nguyên quán</h2>
          <p className="mb-3 text-muted">Mộ phần, nơi sinh, nơi ở được thêm trong hồ sơ từng người.</p>
          <PlaceForm familyId={family.id} personId={null} kinds={FAMILY_KINDS} onSaved={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
        </Card>
      ) : (
        <>
          <MapView places={shown} familyId={family.id} focus={focus} />
          {canEdit(family.role) && (
            <div><Button variant="secondary" onClick={() => setAdding(true)}>+ Thêm nhà thờ họ / nguyên quán</Button></div>
          )}
        </>
      )}

      {places && !all.length && (
        <Card className="text-muted">Chưa có địa điểm nào. Vào hồ sơ từng người để ghim mộ phần, nơi sinh hoặc nơi ở.</Card>
      )}
      {!adding && shown.length > 0 && (
        <Card className="p-0">
          <ul>
            {shown.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: KIND_META[p.kind].color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.person ? (
                      <Link href={`/families/${family.id}/persons/${p.person.id}`} className="text-primary hover:underline">{p.person.displayName}</Link>
                    ) : (
                      p.name
                    )}
                    <span className="ml-2 text-sm text-muted">{KIND_META[p.kind].label}</span>
                  </p>
                  {p.person && <p className="text-sm text-muted">{p.name}{p.precision === 'coarse' ? ' · vị trí gần đúng' : ''}</p>}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFocus((f) => ({ id: p.id, seq: (f?.seq ?? 0) + 1 }));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Xem trên bản đồ
                </Button>
                {p.precision === 'exact' && (
                  <a href={directionsUrl(p)} target="_blank" rel="noopener" className="min-h-11 rounded-lg px-3 py-2 font-medium text-primary hover:bg-gold-soft">
                    Chỉ đường ↗
                  </a>
                )}
                {canEdit(family.role) && (
                  <button onClick={() => remove(p)} className="min-h-11 rounded px-2 text-sm text-danger hover:bg-danger/5" aria-label={`Xóa địa điểm ${p.name}`}>
                    Xóa
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface Anniversary { personId: string; name: string; lunar: { day: number; month: number; isLeapMonth: boolean }; date: string; inDays: number }

function AnniversariesTab({ family }: { family: Family }) {
  const { data, error } = useApi<Anniversary[]>(`/families/${family.id}/anniversaries?days=365`);
  return (
    <div className="flex flex-col gap-3">
      <ErrorBox message={error} />
      <p className="text-muted">Ngày giỗ được tính theo âm lịch. Người mất tháng nhuận được cúng vào tháng thường; ngày 30 ở tháng thiếu được lùi về ngày 29.</p>
      {data?.map((a) => (
        <Card key={a.personId} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/families/${family.id}/persons/${a.personId}`} className="font-serif text-lg font-bold text-primary hover:underline">{a.name}</Link>
            <p className="text-muted">Giỗ ngày {a.lunar.day}/{a.lunar.month}{a.lunar.isLeapMonth ? ' (nhuận)' : ''} âm lịch</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{a.date.split('-').reverse().join('/')}</p>
            <Badge tone={a.inDays <= 14 ? 'warn' : 'default'}>{a.inDays === 0 ? 'Hôm nay' : `Còn ${a.inDays} ngày`}</Badge>
          </div>
        </Card>
      ))}
      {data && !data.length && <Card className="text-muted">Chưa có ngày giỗ nào. Hãy nhập ngày mất âm lịch (ít nhất ngày và tháng) cho người đã mất.</Card>}
    </div>
  );
}

interface Change { id: string; summary: string; status: 'applied' | 'reverted'; createdAt: string; author: string }

function HistoryTab({ family }: { family: Family }) {
  const { data, error, reload } = useApi<Change[]>(`/families/${family.id}/history`);
  const [actionError, setActionError] = useState<string | null>(null);

  async function revert(c: Change) {
    setActionError(null);
    try {
      await api(`/families/${family.id}/history/${c.id}/revert`, { method: 'POST' });
      reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ErrorBox message={error ?? actionError} />
      {data?.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`font-medium ${c.status === 'reverted' ? 'text-muted line-through' : ''}`}>{c.summary}</p>
            <p className="text-sm text-muted">{c.author} · {new Date(c.createdAt).toLocaleString('vi-VN')}</p>
          </div>
          {c.status === 'reverted' ? <Badge>Đã hoàn tác</Badge> : !c.summary.startsWith('Thêm ') && !c.summary.startsWith('Hoàn tác') && (
            <Button variant="secondary" onClick={() => revert(c)}>Hoàn tác</Button>
          )}
        </Card>
      ))}
    </div>
  );
}

interface Member { id: string; email: string; fullName: string; role: Role }

function MembersTab({ family }: { family: Family }) {
  const { data, error, reload } = useApi<Member[]>(`/families/${family.id}/members`);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [formError, setFormError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api(`/families/${family.id}/members`, { method: 'POST', body: { email, role } });
      setEmail('');
      reload();
    } catch (err) {
      setFormError(errorText(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBox message={error} />
      <Card className="p-0">
        <ul>
          {data?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-0">
              <span><span className="font-medium">{m.fullName}</span> <span className="text-muted">· {m.email}</span></span>
              <Badge tone="gold">{ROLE_LABEL[m.role]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      {isAdmin(family.role) && (
        <Card>
          <h2 className="mb-3 font-serif text-xl font-bold">Mời người dùng</h2>
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Email (người này cần đã có tài khoản)">
                {(id) => <input id={id} type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />}
              </Field>
            </div>
            <Field label="Vai trò">
              {(id) => (
                <select id={id} className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {(['co_admin', 'editor', 'member', 'viewer'] as Role[])
                    .filter((r) => family.role === 'owner' || r !== 'co_admin')
                    .map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              )}
            </Field>
            <Button type="submit">Thêm</Button>
          </form>
          <div className="mt-3"><ErrorBox message={formError} /></div>
        </Card>
      )}
    </div>
  );
}
