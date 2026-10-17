export type PlaceKind = 'burial' | 'reburial' | 'cenotaph' | 'birth' | 'residence' | 'ancestral_hall' | 'origin';

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  note: string | null;
  lat: number;
  lng: number;
  precision: 'exact' | 'coarse';
  person: { id: string; displayName: string; generationRecorded: number | null; livingStatus: string } | null;
}

export const KIND_META: Record<PlaceKind, { label: string; color: string; symbol: string }> = {
  burial: { label: 'Mộ phần', color: '#8b1e1e', symbol: '墓' },
  reburial: { label: 'Mộ cải táng', color: '#a0522d', symbol: '墓' },
  cenotaph: { label: 'Mộ gió', color: '#6b5546', symbol: '風' },
  birth: { label: 'Nơi sinh', color: '#2e7d32', symbol: '生' },
  residence: { label: 'Nơi ở', color: '#1565c0', symbol: '居' },
  ancestral_hall: { label: 'Nhà thờ họ', color: '#b8860b', symbol: '祠' },
  origin: { label: 'Nguyên quán', color: '#6a1b9a', symbol: '鄉' },
};

export const PERSON_KINDS_DECEASED: PlaceKind[] = ['burial', 'reburial', 'cenotaph', 'birth', 'residence'];
export const PERSON_KINDS_LIVING: PlaceKind[] = ['birth', 'residence'];
export const FAMILY_KINDS: PlaceKind[] = ['ancestral_hall', 'origin'];

/** Link chỉ đường Google Maps (mở ứng dụng bản đồ trên điện thoại) - chỉ cho điểm chính xác. */
export const directionsUrl = (p: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
