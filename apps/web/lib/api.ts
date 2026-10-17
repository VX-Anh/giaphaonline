const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'giapha.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(res.status, msg ?? 'Có lỗi xảy ra', data.issues);
  }
  return data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    return e.issues?.length ? `${e.message}: ${e.issues.map((i) => i.message).join('; ')}` : e.message;
  }
  return 'Không kết nối được máy chủ';
}

// ---- Kiểu dữ liệu ----

export type Role = 'owner' | 'co_admin' | 'editor' | 'branch_editor' | 'member' | 'viewer';
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Chủ sở hữu',
  co_admin: 'Đồng quản trị',
  editor: 'Biên tập viên',
  branch_editor: 'Biên tập nhánh',
  member: 'Thành viên',
  viewer: 'Người xem',
};
export const canEdit = (r?: Role) => r === 'owner' || r === 'co_admin' || r === 'editor';
export const isAdmin = (r?: Role) => r === 'owner' || r === 'co_admin';

export interface Family {
  id: string;
  name: string;
  surname: string;
  originPlace: string | null;
  description?: string | null;
  role: Role;
  personCount?: number;
}

export interface FlexDate {
  calendar: 'lunar' | 'solar';
  year: number | null;
  month: number | null;
  day: number | null;
  isLeapMonth: boolean;
  qualifier?: 'exact' | 'approximate' | 'before' | 'after';
  originalText?: string | null;
  solarDerived?: { from: string; to: string } | null;
}

export interface Person {
  id: string;
  masked: false;
  displayName: string;
  gender: 'male' | 'female' | 'unknown';
  livingStatus: 'alive' | 'deceased' | 'unknown';
  basisStatus: 'verified' | 'unverified' | 'not_required';
  generationRecorded: number | null;
  siblingOrder: number | null;
  isAnonymous: boolean;
  birthDate: FlexDate | null;
  deathDate: FlexDate | null;
  years: string | null;
  biography: string | null;
  names: { id: string; type: string; valueVi: string; valueHanNom: string | null; isPrimary: boolean }[];
  version: number;
}

export interface MaskedPerson {
  id: string;
  masked: true;
  displayName: string;
}

export type PersonView = Person | MaskedPerson;

export function formatDate(d: FlexDate | null | undefined): string {
  if (!d) return '';
  const parts = [d.day, d.month].filter((x) => x != null);
  const core =
    d.calendar === 'lunar'
      ? `${parts.length ? parts.join('/') + (d.isLeapMonth ? ' (nhuận)' : '') + ' ' : ''}${d.year ?? ''} ÂL`
      : [d.day, d.month, d.year].filter((x) => x != null).join('/');
  const solar = d.calendar === 'lunar' && d.solarDerived && d.solarDerived.from === d.solarDerived.to
    ? ` (${d.solarDerived.from.split('-').reverse().join('/')} DL)`
    : '';
  const q = d.qualifier === 'approximate' ? 'khoảng ' : d.qualifier === 'before' ? 'trước ' : d.qualifier === 'after' ? 'sau ' : '';
  return `${q}${core.trim()}${solar}`;
}
