/**
 * Chuyển đổi âm - dương lịch Việt Nam theo thuật toán của Hồ Ngọc Đức.
 * Múi giờ mặc định UTC+7. Phạm vi được phép quy đổi: 1800-2199 (mục 5.3 kế hoạch).
 */
export const ALGORITHM_VERSION = 'hnd-1.0';
export const MIN_YEAR = 1800;
export const MAX_YEAR = 2199;
const TZ = 7;
const INT = Math.floor;

export interface SolarDate { day: number; month: number; year: number }
export interface LunarDate { day: number; month: number; year: number; leap: boolean }

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): SolarDate {
  let b: number, c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

function newMoon(k: number): number {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltat;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return L;
}

const getSunLongitude = (dayNumber: number) => INT((sunLongitude(dayNumber - 0.5 - TZ / 24) / Math.PI) * 6);
const getNewMoonDay = (k: number) => INT(newMoon(k) + 0.5 + TZ / 24);

function getLunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k);
  if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1);
  return nm;
}

function getLeapMonthOffset(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export function solarToLunar({ day, month, year }: SolarDate): LunarDate {
  const dayNumber = jdFromDate(day, month, year);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let a11 = getLunarMonth11(year);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = getLunarMonth11(year - 1);
  } else {
    lunarYear = year + 1;
    b11 = getLunarMonth11(year + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/** Trả về null nếu ngày âm không tồn tại (vd tháng nhuận không có trong năm, ngày 30 tháng thiếu). */
export function lunarToSolar({ day, month, year, leap }: LunarDate): SolarDate | null {
  let a11: number, b11: number;
  if (month < 11) {
    a11 = getLunarMonth11(year - 1);
    b11 = getLunarMonth11(year);
  } else {
    a11 = getLunarMonth11(year);
    b11 = getLunarMonth11(year + 1);
  }
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  const monthStart = getNewMoonDay(k + off);
  if (day > lunarMonthLength(monthStart)) return null;
  return jdToDate(monthStart + day - 1);
}

function lunarMonthLength(monthStartJd: number): number {
  const k = INT(0.5 + (monthStartJd - 2415021.076998695) / 29.530588853);
  return getNewMoonDay(k + 1) - monthStartJd;
}

/** Tháng nhuận của năm âm lịch (1-12) hoặc 0 nếu không có. */
export function leapMonthOfYear(year: number): number {
  const a11 = getLunarMonth11(year - 1);
  const b11 = getLunarMonth11(year);
  if (b11 - a11 <= 365) return 0;
  const leapMonth = getLeapMonthOffset(a11) - 2;
  return leapMonth < 0 ? leapMonth + 12 : leapMonth;
}

export interface CommemorationRule {
  /** Người mất vào tháng nhuận: cúng vào tháng thường cùng số (mặc định) hay chỉ khi năm đó có tháng nhuận */
  leapRule: 'regular_month' | 'leap_only_else_regular';
  /** Ngày 30 nhưng tháng năm đó chỉ có 29 ngày: lùi về ngày 29 (mặc định) */
  missingDayRule: 'last_day' | 'next_day';
}

export const DEFAULT_RULE: CommemorationRule = { leapRule: 'regular_month', missingDayRule: 'last_day' };

/** Ngày dương lịch của ngày giỗ trong năm âm lịch `lunarYear`. */
export function anniversaryInLunarYear(
  death: { day: number; month: number; leap: boolean },
  lunarYear: number,
  rule: CommemorationRule = DEFAULT_RULE,
): SolarDate {
  const useLeap = death.leap && rule.leapRule === 'leap_only_else_regular' && leapMonthOfYear(lunarYear) === death.month;
  const exact = lunarToSolar({ day: death.day, month: death.month, year: lunarYear, leap: useLeap });
  if (exact) return exact;
  // Ngày 30 ở tháng thiếu
  const day29 = lunarToSolar({ day: 29, month: death.month, year: lunarYear, leap: useLeap })!;
  if (rule.missingDayRule === 'last_day') return day29;
  return jdToDate(jdFromDate(day29.day, day29.month, day29.year) + 1);
}

/** Ngày giỗ kế tiếp tính từ `from` (bao gồm cả ngày `from`). */
export function nextAnniversary(
  death: { day: number; month: number; leap: boolean },
  from: SolarDate,
  rule: CommemorationRule = DEFAULT_RULE,
): SolarDate {
  const fromJd = jdFromDate(from.day, from.month, from.year);
  const lunarYear = solarToLunar(from).year;
  for (const y of [lunarYear, lunarYear + 1]) {
    const d = anniversaryInLunarYear(death, y, rule);
    if (jdFromDate(d.day, d.month, d.year) >= fromJd) return d;
  }
  return anniversaryInLunarYear(death, lunarYear + 2, rule);
}

export function daysBetween(a: SolarDate, b: SolarDate): number {
  return jdFromDate(b.day, b.month, b.year) - jdFromDate(a.day, a.month, a.year);
}

export const toIso = (d: SolarDate) =>
  `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
