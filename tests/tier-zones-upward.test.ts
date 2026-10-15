import { describe, expect, it } from 'vitest';
import { TIER_ZONES } from '../eslint.tier-zones.mjs';
import { UPWARD_EXCEPTIONS } from './tier-zones/upward-exceptions';

// Знімок upward-винятків тір-зон: новий виняток без причини і причина без винятку — червоні.
// Дозволяє підняти імпорт угору лише свідомо (запис у знімку = архітектурне рішення).

/** `зона→тека` з таблиці зон: upward-теки (4-й елемент) і файли-винятки (6-й). */
function zoneExceptions(): string[] {
  const keys: string[] = [];
  for (const [dir, , name, upward, , exemptFiles = []] of TIER_ZONES as [
    string,
    number,
    string | null,
    string[],
    string[]?,
    string[]?,
  ][]) {
    for (const target of [...upward, ...exemptFiles])
      keys.push(`${name ?? dir}→${target}`);
  }
  return keys.sort();
}

describe('знімок upward-винятків тір-зон', () => {
  it('кожен виняток зони має запис зі знімка', () => {
    const missing = zoneExceptions().filter((k) => !(k in UPWARD_EXCEPTIONS));
    expect(
      missing,
      'виняток без причини у tests/tier-zones/upward-exceptions.ts',
    ).toEqual([]);
  });

  it('у знімку немає записів без винятку в зоні', () => {
    const live = new Set(zoneExceptions());
    const stale = Object.keys(UPWARD_EXCEPTIONS).filter((k) => !live.has(k));
    expect(stale, 'запис знімка без винятку в eslint.tier-zones.mjs').toEqual(
      [],
    );
  });

  it('причина кожного запису непорожня', () => {
    const empty = Object.entries(UPWARD_EXCEPTIONS)
      .filter(([, reason]) => reason.trim().length < 10)
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
