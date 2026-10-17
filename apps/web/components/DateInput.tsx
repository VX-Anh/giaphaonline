'use client';

import { FlexDate } from '@/lib/api';
import { inputClass } from './ui';

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Nhập ngày linh hoạt: âm/dương lịch, có thể chỉ biết năm hoặc tháng-ngày (mục 5.3). */
export function DateInput({ label, value, onChange }: { label: string; value: FlexDate | null; onChange: (d: FlexDate | null) => void }) {
  const d: FlexDate = value ?? { calendar: 'lunar', year: null, month: null, day: null, isLeapMonth: false };
  const set = (patch: Partial<FlexDate>) => {
    const next = { ...d, ...patch };
    if (next.calendar !== 'lunar') next.isLeapMonth = false;
    onChange(next.year == null && next.month == null && next.day == null ? null : next);
  };
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 font-medium">{label}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          Lịch
          <select className={inputClass} value={d.calendar} onChange={(e) => set({ calendar: e.target.value as FlexDate['calendar'] })}>
            <option value="lunar">Âm lịch</option>
            <option value="solar">Dương lịch</option>
          </select>
        </label>
        <label className="flex w-20 flex-col text-sm">
          Ngày
          <input className={inputClass} inputMode="numeric" value={d.day ?? ''} onChange={(e) => set({ day: num(e.target.value) })} />
        </label>
        <label className="flex w-20 flex-col text-sm">
          Tháng
          <input className={inputClass} inputMode="numeric" value={d.month ?? ''} onChange={(e) => set({ month: num(e.target.value) })} />
        </label>
        <label className="flex w-28 flex-col text-sm">
          Năm
          <input className={inputClass} inputMode="numeric" value={d.year ?? ''} onChange={(e) => set({ year: num(e.target.value) })} />
        </label>
        {d.calendar === 'lunar' && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={d.isLeapMonth} onChange={(e) => set({ isLeapMonth: e.target.checked })} />
            Tháng nhuận
          </label>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">Có thể bỏ trống phần không biết (vd chỉ biết ngày tháng giỗ).</p>
    </fieldset>
  );
}
