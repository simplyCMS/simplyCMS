import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PENDING_LEGACY,
  SERVER_FIRST_EXCEPTIONS,
} from './admin-server-first/registry';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_DIR = 'packages/simplycms/src/admin';

/**
 * Той самий скан, що й `rg -l useSupabaseClient <тека>`: усі `.ts/.tsx`
 * рекурсивно, шляхи відносні від кореня репо. На Node (fs), без залежності
 * від `rg`.
 */
function filesWithUseSupabaseClient(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        readFileSync(join(ROOT, next), 'utf8').includes('useSupabaseClient')
      ) {
        out.push(next);
      }
    }
  };
  walk(dir);
  return out.sort();
}

const actual = filesWithUseSupabaseClient(ADMIN_DIR);
const registered = [...SERVER_FIRST_EXCEPTIONS, ...PENDING_LEGACY].map(
  (e) => e.file,
);

describe('реєстр легасі-адмінки й винятків server-first К3-2', () => {
  it('кожен легасі-файл адмінки зареєстрований (виняток К3-2 або хвиля)', () => {
    expect(actual.filter((f) => !registered.includes(f))).toEqual([]);
  });

  it('у реєстрі немає протухлих записів (файл існує і ще легасі)', () => {
    expect(registered.filter((f) => !actual.includes(f))).toEqual([]);
  });

  it('винятки К3-2 називають сутності, операції й причину', () => {
    for (const e of SERVER_FIRST_EXCEPTIONS) {
      expect(e.entities.length, e.file).toBeGreaterThan(0);
      expect(e.operations.length, e.file).toBeGreaterThan(0);
      expect(e.reason.length, e.file).toBeGreaterThan(10);
    }
  });

  it('файл не стоїть в обох списках і не дублюється', () => {
    expect(new Set(registered).size).toBe(registered.length);
  });

  it('число записів дорівнює числу легасі-файлів', () => {
    expect(registered.length).toBe(actual.length);
  });
});
