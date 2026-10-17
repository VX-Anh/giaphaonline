import {
  anniversaryInLunarYear,
  leapMonthOfYear,
  lunarToSolar,
  nextAnniversary,
  solarToLunar,
  toIso,
} from './lunar';

describe('lunar calendar', () => {
  it.each([
    // Tết Nguyên đán
    [{ day: 10, month: 2, year: 2024 }, { day: 1, month: 1, year: 2024, leap: false }],
    [{ day: 29, month: 1, year: 2025 }, { day: 1, month: 1, year: 2025, leap: false }],
    [{ day: 17, month: 2, year: 2026 }, { day: 1, month: 1, year: 2026, leap: false }],
    [{ day: 22, month: 1, year: 2023 }, { day: 1, month: 1, year: 2023, leap: false }],
    // Trung thu 2024
    [{ day: 17, month: 9, year: 2024 }, { day: 15, month: 8, year: 2024, leap: false }],
    // Tháng nhuận: 1/2 nhuận Quý Mão = 22/3/2023, 1/6 nhuận Ất Tỵ = 25/7/2025
    [{ day: 22, month: 3, year: 2023 }, { day: 1, month: 2, year: 2023, leap: true }],
    [{ day: 25, month: 7, year: 2025 }, { day: 1, month: 6, year: 2025, leap: true }],
    // Cuối năm âm rơi sang năm dương sau
    [{ day: 9, month: 2, year: 2024 }, { day: 30, month: 12, year: 2023, leap: false }],
  ])('solar %j <-> lunar %j', (solar, lunar) => {
    expect(solarToLunar(solar)).toEqual(lunar);
    expect(lunarToSolar(lunar)).toEqual(solar);
  });

  it('round-trips every day across 1900-2100', () => {
    for (let y = 1900; y <= 2100; y += 7) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15, 28]) {
          const lunar = solarToLunar({ day: d, month: m, year: y });
          expect(lunarToSolar(lunar)).toEqual({ day: d, month: m, year: y });
        }
      }
    }
  });

  it('knows which years have a leap month', () => {
    expect(leapMonthOfYear(2023)).toBe(2);
    expect(leapMonthOfYear(2025)).toBe(6);
    expect(leapMonthOfYear(2024)).toBe(0);
  });

  it('rejects non-existent lunar dates', () => {
    expect(lunarToSolar({ day: 1, month: 3, year: 2024, leap: true })).toBeNull();
  });

  it('moves a day-30 anniversary to day 29 in a short month', () => {
    // Tìm một năm mà tháng 1 âm chỉ có 29 ngày
    for (let y = 2020; y < 2040; y++) {
      if (lunarToSolar({ day: 30, month: 1, year: y, leap: false }) === null) {
        const d = anniversaryInLunarYear({ day: 30, month: 1, leap: false }, y);
        expect(d).toEqual(lunarToSolar({ day: 29, month: 1, year: y, leap: false }));
        return;
      }
    }
    throw new Error('no short month found');
  });

  it('observes a leap-month death in the regular month by default', () => {
    const d = anniversaryInLunarYear({ day: 10, month: 2, leap: true }, 2023);
    expect(d).toEqual(lunarToSolar({ day: 10, month: 2, year: 2023, leap: false }));
    const leapOnly = anniversaryInLunarYear({ day: 10, month: 2, leap: true }, 2023, {
      leapRule: 'leap_only_else_regular',
      missingDayRule: 'last_day',
    });
    expect(leapOnly).toEqual(lunarToSolar({ day: 10, month: 2, year: 2023, leap: true }));
  });

  it('finds the next anniversary, rolling into next lunar year', () => {
    // Giỗ 15/8 âm, tính từ 18/9/2024 (sau Trung thu 2024) -> 15/8 Ất Tỵ = 6/10/2025
    expect(toIso(nextAnniversary({ day: 15, month: 8, leap: false }, { day: 18, month: 9, year: 2024 }))).toBe(
      '2025-10-06',
    );
    expect(toIso(nextAnniversary({ day: 15, month: 8, leap: false }, { day: 17, month: 9, year: 2024 }))).toBe(
      '2024-09-17',
    );
  });
});
