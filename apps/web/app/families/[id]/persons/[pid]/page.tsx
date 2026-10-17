'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { MapView } from '@/components/MapView';
import { PersonForm } from '@/components/PersonForm';
import { PlaceForm } from '@/components/PlaceForm';
import { directionsUrl, KIND_META, Place, PERSON_KINDS_DECEASED, PERSON_KINDS_LIVING } from '@/lib/places';
import { Badge, Button, Card, ErrorBox, Field, inputClass, PageTitle } from '@/components/ui';
import { api, canEdit, errorText, Family, formatDate, isAdmin, Person, PersonView } from '@/lib/api';
import { useApi, useRequireAuth } from '@/lib/hooks';

type Related = { id: string; personId: string; type?: string; unionLabel?: string | null; person: PersonView & { years?: string | null } };
type PersonDetail = Person & { parents: Related[]; children: Related[]; unions: Related[] };

const REL_TYPE: Record<string, string> = { biological: '', adoptive: 'con nuôi', heir_adoption: 'thừa tự', unknown: 'chưa rõ' };

export default function PersonPage() {
  const authed = useRequireAuth();
  const { id: familyId, pid } = useParams<{ id: string; pid: string }>();
  const { data: family } = useApi<Family>(authed ? `/families/${familyId}` : null);
  const { data: person, error, reload } = useApi<PersonDetail | (PersonView & { masked: true })>(authed ? `/families/${familyId}/persons/${pid}` : null);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!authed) return null;
  if (error) return <ErrorBox message={error} />;
  if (!person || !family) return <p className="text-muted">Đang tải…</p>;
  if (person.masked) return <Card className="italic text-muted">{person.displayName}: thông tin người còn sống được bảo vệ.</Card>;

  const p = person as PersonDetail;
  const editable = canEdit(family.role);

  async function verify() {
    setActionError(null);
    try {
      await api(`/families/${familyId}/persons/${pid}/verify-basis`, { method: 'POST' });
      reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <>
      <Link href={`/families/${familyId}`} className="text-primary hover:underline">← {family.name}</Link>
      <div className="mt-3">
        <PageTitle
          sub={
            <span className="flex flex-wrap items-center gap-2">
              {p.generationRecorded && <Badge tone="gold">Đời thứ {p.generationRecorded}</Badge>}
              <Badge>{p.livingStatus === 'deceased' ? 'Đã mất' : p.livingStatus === 'alive' ? 'Còn sống' : 'Chưa rõ'}</Badge>
              {p.basisStatus === 'unverified' && <Badge tone="warn">Chưa xác minh căn cứ</Badge>}
            </span>
          }
        >
          {p.displayName}
          {p.names.find((n) => n.isPrimary)?.valueHanNom && <span className="ml-3 text-2xl text-muted" lang="zh-Hant">{p.names.find((n) => n.isPrimary)!.valueHanNom}</span>}
        </PageTitle>
      </div>
      <ErrorBox message={actionError} />

      {p.basisStatus === 'unverified' && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <p>Người này còn sống hoặc chưa rõ, chỉ người nhập và ban quản lý họ thấy được. Khi đã có sự đồng ý của người này (hoặc người đại diện), ban quản lý xác minh để hiển thị cho các thành viên trong họ.</p>
          {isAdmin(family.role) && <Button className="mt-3" onClick={verify}>Xác nhận đã có căn cứ</Button>}
        </div>
      )}

      {editing ? (
        <Card>
          <PersonForm familyId={familyId} person={p} onSaved={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted">Giới tính</dt><dd>{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Chưa rõ'}</dd>
              {p.siblingOrder && <><dt className="text-muted">Thứ tự con</dt><dd>Con thứ {p.siblingOrder}</dd></>}
              <dt className="text-muted">Ngày sinh</dt><dd>{formatDate(p.birthDate) || '—'}</dd>
              {p.livingStatus === 'deceased' && <><dt className="text-muted">Ngày mất</dt><dd>{formatDate(p.deathDate) || '—'}</dd></>}
            </dl>
            {p.biography && <p className="mt-4 whitespace-pre-line">{p.biography}</p>}
            {editable && <Button variant="secondary" className="mt-4" onClick={() => setEditing(true)}>Sửa thông tin</Button>}
          </Card>
          <div className="flex flex-col gap-4">
            <RelationList title="Cha mẹ" items={p.parents} familyId={familyId} editable={editable} kind="parent-child" onChange={reload} onError={setActionError} />
            <RelationList title="Vợ / chồng" items={p.unions} familyId={familyId} editable={editable} kind="unions" onChange={reload} onError={setActionError} />
            <RelationList title="Con" items={p.children} familyId={familyId} editable={editable} kind="parent-child" onChange={reload} onError={setActionError} />
          </div>
        </div>
      )}

      {!editing && <PlacesSection familyId={familyId} person={p} editable={editable} />}
      {editable && !editing && <AddRelation familyId={familyId} person={p} onDone={reload} />}
    </>
  );
}

function PlacesSection({ familyId, person, editable }: { familyId: string; person: Person; editable: boolean }) {
  const { data: places, error, reload } = useApi<Place[]>(`/families/${familyId}/places?personId=${person.id}`);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const deceased = person.livingStatus === 'deceased';

  async function remove(pl: Place) {
    setActionError(null);
    try {
      await api(`/families/${familyId}/places/${pl.id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="mb-3 font-serif text-xl font-bold text-primary">Địa điểm</h2>
      <ErrorBox message={error ?? actionError} />
      {adding ? (
        <PlaceForm
          familyId={familyId}
          personId={person.id}
          kinds={deceased ? PERSON_KINDS_DECEASED : PERSON_KINDS_LIVING}
          coarse={!deceased}
          onSaved={() => { setAdding(false); reload(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {places && places.length > 0 && <MapView places={places} familyId={familyId} className="h-[320px]" />}
          {places?.map((pl) => (
            <div key={pl.id} className="flex flex-wrap items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: KIND_META[pl.kind].color }} aria-hidden />
              <span className="font-medium">{KIND_META[pl.kind].label}:</span>
              <span>{pl.name}</span>
              {pl.note && <span className="text-muted">— {pl.note}</span>}
              {pl.precision === 'exact' ? (
                <a href={directionsUrl(pl)} target="_blank" rel="noopener" className="font-medium text-primary hover:underline">Chỉ đường ↗</a>
              ) : (
                <Badge>vị trí gần đúng</Badge>
              )}
              {editable && (
                <button onClick={() => remove(pl)} className="min-h-9 rounded px-2 text-sm text-danger hover:bg-danger/5">Xóa</button>
              )}
            </div>
          ))}
          {places && !places.length && <p className="text-muted">Chưa ghim địa điểm nào{deceased ? ' (mộ phần, nơi sinh…)' : ''}.</p>}
          {editable && <div><Button variant="secondary" onClick={() => setAdding(true)}>+ Ghim địa điểm</Button></div>}
        </div>
      )}
    </Card>
  );
}

function RelationList({ title, items, familyId, editable, kind, onChange, onError }: {
  title: string; items: Related[]; familyId: string; editable: boolean; kind: 'parent-child' | 'unions'; onChange: () => void; onError: (m: string | null) => void;
}) {
  async function remove(id: string) {
    onError(null);
    try {
      await api(`/families/${familyId}/${kind}/${id}`, { method: 'DELETE' });
      onChange();
    } catch (e) {
      onError(errorText(e));
    }
  }
  return (
    <Card>
      <h2 className="mb-2 font-serif text-lg font-bold text-primary">{title}</h2>
      {items.length ? (
        <ul className="flex flex-col gap-1">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              {r.person.masked ? (
                <span className="italic text-muted">{r.person.displayName}</span>
              ) : (
                <Link href={`/families/${familyId}/persons/${r.personId}`} className="hover:underline">
                  {r.person.displayName}
                  {r.type && REL_TYPE[r.type] && <span className="ml-1 text-sm text-muted">({REL_TYPE[r.type]})</span>}
                  {r.unionLabel && <span className="ml-1 text-sm text-muted">({r.unionLabel})</span>}
                </Link>
              )}
              {editable && (
                <button onClick={() => remove(r.id)} className="min-h-9 rounded px-2 text-sm text-danger hover:bg-danger/5" aria-label={`Gỡ quan hệ với ${r.person.displayName}`}>
                  Gỡ
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Chưa có</p>
      )}
    </Card>
  );
}

function AddRelation({ familyId, person, onDone }: { familyId: string; person: Person; onDone: () => void }) {
  const { data: people } = useApi<PersonView[]>(`/families/${familyId}/persons`);
  const [kind, setKind] = useState<'parent' | 'child' | 'spouse'>('child');
  const [otherId, setOtherId] = useState('');
  const [type, setType] = useState('biological');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options = (people ?? []).filter((x) => !x.masked && x.id !== person.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (kind === 'spouse') {
        await api(`/families/${familyId}/unions`, { method: 'POST', body: { partner1Id: person.id, partner2Id: otherId, unionLabel: label || null } });
      } else {
        const [parentId, childId] = kind === 'parent' ? [otherId, person.id] : [person.id, otherId];
        await api(`/families/${familyId}/parent-child`, { method: 'POST', body: { parentId, childId, type } });
      }
      setOtherId('');
      setLabel('');
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="mb-3 font-serif text-xl font-bold">Thêm quan hệ</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Loại quan hệ">
            {(id) => (
              <select id={id} className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="child">Con của {person.displayName}</option>
                <option value="parent">Cha/mẹ của {person.displayName}</option>
                <option value="spouse">Vợ/chồng</option>
              </select>
            )}
          </Field>
          <Field label="Người">
            {(id) => (
              <select id={id} className={inputClass} value={otherId} onChange={(e) => setOtherId(e.target.value)} required>
                <option value="">— Chọn —</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
              </select>
            )}
          </Field>
          {kind === 'spouse' ? (
            <Field label="Danh phận" hint="vd chính thất, kế thất">
              {(id) => <input id={id} className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />}
            </Field>
          ) : (
            <Field label="Hình thức">
              {(id) => (
                <select id={id} className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="biological">Con đẻ</option>
                  <option value="adoptive">Con nuôi</option>
                  <option value="heir_adoption">Thừa tự</option>
                  <option value="unknown">Chưa rõ</option>
                </select>
              )}
            </Field>
          )}
        </div>
        <ErrorBox message={error} />
        <div><Button type="submit">Thêm quan hệ</Button></div>
      </form>
    </Card>
  );
}
