import { afterAll, describe, expect, it } from 'vitest';
import {
  fromDateTimeLocal,
  keepUnchangedDate,
  toDateTimeLocal,
} from '../datetime-local';

// Пояс із переходами на літній/зимовий час — саме тут легасі зсував дати.
// Node підхоплює зміну TZ у рантаймі (хелпери пояс не кешують); відновлюємо,
// щоб не зачепити інші файли того самого воркера.
const previousTz = process.env.TZ;
process.env.TZ = 'Europe/Kyiv';
afterAll(() => {
  // Присвоєння `undefined` записало б рядок 'undefined' — тож delete.
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

const toMinute = (d: Date) => new Date(Math.floor(d.getTime() / 60000) * 60000);

describe('datetime-local (Е6в-22)', () => {
  it.each([
    ['2026-03-29T00:30:00.000Z', '2026-03-29T02:30'], // день переходу на літній
    ['2026-10-25T00:30:00.000Z', '2026-10-25T03:30'], // перша «03:30» зимового
    ['2026-07-01T12:34:56.789Z', '2026-07-01T15:34'],
  ])(
    '%s → локальний «%s» → назад той самий момент до хвилини',
    (iso, local) => {
      const d = new Date(iso);
      expect(toDateTimeLocal(d)).toBe(local);
      expect(fromDateTimeLocal(toDateTimeLocal(d))?.getTime()).toBe(
        toMinute(d).getTime(),
      );
    },
  );

  it('порожнє й сміття → null; null → порожній рядок', () => {
    expect(fromDateTimeLocal('')).toBeNull();
    expect(fromDateTimeLocal('abc')).toBeNull();
    expect(fromDateTimeLocal('2026-02-31T10:00')).toBeNull();
    expect(fromDateTimeLocal('2026-05-01T24:00')).toBeNull();
    expect(toDateTimeLocal(null)).toBe('');
  });

  it('повторена година: друга «03:30» (01:30Z) кругообігом рядка зсувається — тому незмінене поле тримає оригінал', () => {
    const second = new Date('2026-10-25T01:30:00.000Z');
    const shown = toDateTimeLocal(second);
    expect(shown).toBe('2026-10-25T03:30');
    // Відома межа браузера: неоднозначна година бере ПЕРШИЙ зсув.
    expect(fromDateTimeLocal(shown)?.toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
    expect(keepUnchangedDate(shown, second)).toBe(second);
    expect(keepUnchangedDate('2026-10-26T10:00', second)?.toISOString()).toBe(
      '2026-10-26T08:00:00.000Z',
    );
    expect(keepUnchangedDate('', second)).toBeNull();
    expect(keepUnchangedDate('', null)).toBeNull();
  });
});
