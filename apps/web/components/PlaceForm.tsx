'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { KIND_META, Place, PlaceKind } from '@/lib/places';
import { MapView } from './MapView';
import { Button, ErrorBox, Field, inputClass } from './ui';

interface Props {
  familyId: string;
  personId: string | null;
  kinds: PlaceKind[];
  /** Người còn sống/chưa rõ: tọa độ sẽ bị làm tròn ~10 km */
  coarse?: boolean;
  onSaved: (p: Place) => void;
  onCancel: () => void;
}

/** Ghim vị trí bằng cách bấm lên bản đồ hoặc lấy GPS khi đang đứng tại mộ. */
export function PlaceForm({ familyId, personId, kinds, coarse, onSaved, onCancel }: Props) {
  // Các địa điểm sẵn có của dòng họ làm mốc, để bản đồ mở sẵn quanh làng thay vì cả nước
  const { data: existing } = useApi<Place[]>(`/families/${familyId}/places`);
  const [kind, setKind] = useState<PlaceKind>(kinds[0]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  function useGps() {
    if (!navigator.geolocation) return setError('Thiết bị không hỗ trợ định vị');
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPicked({ lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude) });
        setLocating(false);
      },
      () => {
        setError('Không lấy được vị trí. Hãy cho phép trình duyệt truy cập vị trí hoặc bấm trực tiếp lên bản đồ.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return setError('Hãy bấm lên bản đồ để chọn vị trí');
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Place>(`/families/${familyId}/places`, {
        method: 'POST',
        body: { personId, kind, name: name.trim(), note: coarse ? null : note.trim() || null, ...picked },
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại địa điểm">
          {(id) => (
            <select id={id} className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as PlaceKind)}>
              {kinds.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
            </select>
          )}
        </Field>
        <Field label={coarse ? 'Tên tỉnh/huyện' : 'Tên địa điểm'} hint={coarse ? 'Chỉ ghi cấp tỉnh/huyện, không ghi địa chỉ nhà' : 'vd Nghĩa trang thôn Đông, xã Đông Ngạc'}>
          {(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />}
        </Field>
      </div>
      {!coarse && (
        <Field label="Ghi chú chỉ đường" hint="vd: vào cổng chính, rẽ trái, hàng thứ 3">
          {(id) => <input id={id} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />}
        </Field>
      )}
      {coarse && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          Người còn sống hoặc chưa rõ: vị trí sẽ được làm tròn khoảng 10 km khi lưu, không ai xem được địa chỉ chính xác.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Vị trí:</span>
        {picked ? <span className="tabular-nums">{picked.lat}, {picked.lng}</span> : <span className="text-muted">bấm lên bản đồ để ghim</span>}
        <Button type="button" variant="secondary" onClick={useGps} disabled={locating}>
          {locating ? 'Đang định vị…' : '📍 Dùng vị trí hiện tại'}
        </Button>
      </div>
      <MapView places={existing ?? []} familyId={familyId} picked={picked} onPick={setPicked} className="h-[380px]" />
      <ErrorBox message={error} />
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu địa điểm'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
