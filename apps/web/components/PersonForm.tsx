'use client';

import { useState } from 'react';
import { api, errorText, FlexDate, Person } from '@/lib/api';
import { DateInput } from './DateInput';
import { Button, ErrorBox, Field, inputClass } from './ui';

interface Props {
  familyId: string;
  person?: Person;
  onSaved: (p: Person) => void;
  onCancel?: () => void;
}

/** Thêm người mới (POST) hoặc sửa thông tin (PATCH, có kiểm tra phiên bản). */
export function PersonForm({ familyId, person, onSaved, onCancel }: Props) {
  const [name, setName] = useState(person?.names.find((n) => n.isPrimary)?.valueVi ?? '');
  const [hanNom, setHanNom] = useState(person?.names.find((n) => n.isPrimary)?.valueHanNom ?? '');
  const [gender, setGender] = useState<Person['gender']>(person?.gender ?? 'male');
  const [livingStatus, setLivingStatus] = useState<Person['livingStatus']>(person?.livingStatus ?? 'deceased');
  const [generation, setGeneration] = useState(person?.generationRecorded?.toString() ?? '');
  const [siblingOrder, setSiblingOrder] = useState(person?.siblingOrder?.toString() ?? '');
  const [birthDate, setBirthDate] = useState<FlexDate | null>(person?.birthDate ?? null);
  const [deathDate, setDeathDate] = useState<FlexDate | null>(person?.deathDate ?? null);
  const [biography, setBiography] = useState(person?.biography ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strip = (d: FlexDate | null) => d && { calendar: d.calendar, year: d.year, month: d.month, day: d.day, isLeapMonth: d.isLeapMonth };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fields = {
      gender,
      livingStatus,
      generationRecorded: generation ? Number(generation) : null,
      siblingOrder: siblingOrder ? Number(siblingOrder) : null,
      birthDate: strip(birthDate),
      deathDate: livingStatus === 'deceased' ? strip(deathDate) : null,
      biography: biography.trim() || null,
    };
    try {
      const saved = person
        ? await api<Person>(`/families/${familyId}/persons/${person.id}`, { method: 'PATCH', body: { ...fields, version: person.version } })
        : await api<Person>(`/families/${familyId}/persons`, {
            method: 'POST',
            body: { ...fields, names: [{ type: 'birth', valueVi: name.trim(), valueHanNom: hanNom.trim() || null, isPrimary: true }] },
          });
      onSaved(saved);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!person && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên">{(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
          <Field label="Chữ Hán Nôm (nếu có)">
            {(id) => <input id={id} className={inputClass} value={hanNom} onChange={(e) => setHanNom(e.target.value)} lang="zh-Hant" />}
          </Field>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Giới tính">
          {(id) => (
            <select id={id} className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Person['gender'])}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="unknown">Chưa rõ</option>
            </select>
          )}
        </Field>
        <Field label="Tình trạng">
          {(id) => (
            <select id={id} className={inputClass} value={livingStatus} onChange={(e) => setLivingStatus(e.target.value as Person['livingStatus'])}>
              <option value="deceased">Đã mất</option>
              <option value="alive">Còn sống</option>
              <option value="unknown">Chưa rõ</option>
            </select>
          )}
        </Field>
        <Field label="Đời thứ">
          {(id) => <input id={id} className={inputClass} inputMode="numeric" value={generation} onChange={(e) => setGeneration(e.target.value)} />}
        </Field>
        <Field label="Thứ tự con">
          {(id) => <input id={id} className={inputClass} inputMode="numeric" value={siblingOrder} onChange={(e) => setSiblingOrder(e.target.value)} />}
        </Field>
      </div>
      {livingStatus !== 'deceased' && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          Người còn sống hoặc chưa rõ sẽ ở trạng thái <strong>chưa xác minh căn cứ</strong>: chỉ bạn và ban quản lý họ thấy cho đến khi
          được xác minh đồng ý.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <DateInput label="Ngày sinh" value={birthDate} onChange={setBirthDate} />
        {livingStatus === 'deceased' && <DateInput label="Ngày mất (dùng để tính ngày giỗ)" value={deathDate} onChange={setDeathDate} />}
      </div>
      <Field label="Tiểu sử">
        {(id) => <textarea id={id} className={`${inputClass} min-h-28`} value={biography} onChange={(e) => setBiography(e.target.value)} />}
      </Field>
      <ErrorBox message={error} />
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : person ? 'Lưu thay đổi' : 'Thêm người'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}
