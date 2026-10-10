import { describe, expect, it } from 'vitest';
import type { Banner } from 'simplycms/contracts';
import { isBannerVisible } from '../banner';

const base = {
  date_from: null,
  date_to: null,
  schedule_days: null,
  schedule_time_from: '09:00:00',
  schedule_time_to: '17:00:00',
} as Banner;

const at = (h: number, m: number) => new Date(2026, 0, 5, h, m, 30);

describe('isBannerVisible: хвилинна точність розкладу (р3 B2)', () => {
  it('time Postgres HH:MM:SS: межі включно', () => {
    expect(isBannerVisible(base, at(9, 0))).toBe(true);
    expect(isBannerVisible(base, at(17, 0))).toBe(true);
    expect(isBannerVisible(base, at(8, 59))).toBe(false);
    expect(isBannerVisible(base, at(17, 1))).toBe(false);
  });

  it('формат HH:MM поводиться так само', () => {
    const b = {
      ...base,
      schedule_time_from: '09:00',
      schedule_time_to: '17:00',
    };
    expect(isBannerVisible(b, at(9, 0))).toBe(true);
    expect(isBannerVisible(b, at(17, 0))).toBe(true);
    expect(isBannerVisible(b, at(8, 59))).toBe(false);
    expect(isBannerVisible(b, at(17, 1))).toBe(false);
  });
});
