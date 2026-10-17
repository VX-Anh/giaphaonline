import { z } from 'zod';
import { ALGORITHM_VERSION, MAX_YEAR, MIN_YEAR, lunarToSolar, toIso } from '../lunar/lunar';

/** Cấu trúc ngày linh hoạt - mục 5.3 kế hoạch. */
const datePoint = {
  calendar: z.enum(['lunar', 'solar']),
  year: z.number().int().nullable().default(null),
  month: z.number().int().min(1).max(12).nullable().default(null),
  day: z.number().int().min(1).max(31).nullable().default(null),
  isLeapMonth: z.boolean().default(false),
};

const point = z.object(datePoint);
type Point = z.infer<typeof point>;

export const flexibleDateInput = z
  .object({
    ...datePoint,
    qualifier: z.enum(['exact', 'approximate', 'before', 'after']).default('exact'),
    rangeEnd: point.nullable().default(null),
    originalText: z.string().max(500).nullable().default(null),
  })
  .superRefine((d, ctx) => {
    for (const [p, path] of [[d, []], ...(d.rangeEnd ? [[d.rangeEnd, ['rangeEnd']]] : [])] as [Point, string[]][]) {
      if (p.day !== null && p.month === null)
        ctx.addIssue({ code: 'custom', path: [...path, 'day'], message: 'Có ngày thì phải có tháng' });
      if (p.isLeapMonth && (p.calendar !== 'lunar' || p.month === null))
        ctx.addIssue({ code: 'custom', path: [...path, 'isLeapMonth'], message: 'Tháng nhuận chỉ áp dụng cho âm lịch có tháng' });
      if (p.year === null && p.month === null && d.originalText === null)
        ctx.addIssue({ code: 'custom', path, message: 'Cần ít nhất năm, tháng hoặc nguyên văn' });
    }
    if (d.rangeEnd) {
      if (d.rangeEnd.calendar !== d.calendar)
        ctx.addIssue({ code: 'custom', path: ['rangeEnd', 'calendar'], message: 'Khoảng ngày phải cùng loại lịch' });
      if (d.year === null || d.rangeEnd.year === null || d.rangeEnd.year < d.year)
        ctx.addIssue({ code: 'custom', path: ['rangeEnd', 'year'], message: 'Khoảng ngày cần năm và năm kết thúc ≥ năm bắt đầu' });
    }
    if (d.calendar === 'lunar' && d.year !== null && d.month !== null && d.year >= MIN_YEAR && d.year <= MAX_YEAR) {
      if (!lunarToSolar({ day: d.day ?? 1, month: d.month, year: d.year, leap: d.isLeapMonth }))
        ctx.addIssue({ code: 'custom', path: ['day'], message: 'Ngày âm lịch không tồn tại' });
    }
  });

export type FlexibleDateInput = z.infer<typeof flexibleDateInput>;

export interface StoredDate extends FlexibleDateInput {
  solarDerived: { from: string; to: string; algorithmVersion: string } | null;
}

/** Gắn giá trị dương lịch dẫn xuất (luôn là khoảng) nếu đủ dữ kiện và trong phạm vi quy đổi. */
export function toStoredDate(d: FlexibleDateInput): StoredDate {
  return { ...d, solarDerived: deriveSolar(d) };
}

function deriveSolar(d: FlexibleDateInput) {
  const start = pointRange(d);
  if (!start) return null;
  const end = d.rangeEnd ? pointRange({ ...d.rangeEnd }) : start;
  if (!end) return null;
  return { from: start.from, to: end.to, algorithmVersion: ALGORITHM_VERSION };
}

function pointRange(p: Point): { from: string; to: string } | null {
  if (p.year === null) return null;
  if (p.calendar === 'solar') {
    if (p.month === null) return { from: `${pad(p.year, 4)}-01-01`, to: `${pad(p.year, 4)}-12-31` };
    if (p.day === null) {
      const last = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
      return { from: `${pad(p.year, 4)}-${pad(p.month)}-01`, to: `${pad(p.year, 4)}-${pad(p.month)}-${pad(last)}` };
    }
    const iso = `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
    return { from: iso, to: iso };
  }
  if (p.year < MIN_YEAR || p.year > MAX_YEAR) return null;
  const leap = p.isLeapMonth;
  if (p.month === null) {
    const from = lunarToSolar({ day: 1, month: 1, year: p.year, leap: false });
    const nextNewYear = lunarToSolar({ day: 1, month: 1, year: p.year + 1, leap: false });
    if (!from || !nextNewYear) return null;
    return { from: toIso(from), to: dayBefore(nextNewYear) };
  }
  if (p.day === null) {
    const from = lunarToSolar({ day: 1, month: p.month, year: p.year, leap });
    const last = lunarToSolar({ day: 30, month: p.month, year: p.year, leap }) ??
      lunarToSolar({ day: 29, month: p.month, year: p.year, leap });
    if (!from || !last) return null;
    return { from: toIso(from), to: toIso(last) };
  }
  const exact = lunarToSolar({ day: p.day, month: p.month, year: p.year, leap });
  return exact ? { from: toIso(exact), to: toIso(exact) } : null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function dayBefore(d: { day: number; month: number; year: number }): string {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day - 1));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
