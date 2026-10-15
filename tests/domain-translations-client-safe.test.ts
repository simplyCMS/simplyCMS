import { describe, expect, it } from 'vitest';
import {
  SERVER_ONLY,
  isServerOnlySubpath,
} from '../packages/simplycms/src/contracts/server-only';
import {
  ROOTS,
  scan,
  scanFixture,
} from './domain-translations-client-safe/scan';

/**
 * `domain/translations` і `domain/slugs` — T1: їх імпортує й клієнтський бандл
 * адмінки. Скан, його пастки (статичний розбір, а не «імпортували й не впало») і
 * перелік server-only — у `domain-translations-client-safe/scan.ts`.
 */
describe('domain/translations і domain/slugs клієнтобезпечні (T1)', () => {
  const { files, violations } = scan(ROOTS);

  it('розбір справді бачить обидва дерева (порожній скан нічого б не довів)', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'domain/translations/index.ts',
        'domain/translations/write-plan.ts',
        'domain/slugs/index.ts',
        'domain/slugs/translit-uk.ts',
      ]),
    );
  });

  it('декларація server-only непорожня і містить translations (сентинел самого скану)', () => {
    expect(SERVER_ONLY).toContain('translations');
    expect(isServerOnlySubpath('translations')).toBe(true);
    expect(isServerOnlySubpath('domain/translations')).toBe(false);
  });

  it('жодного node:, server-only субшляху чи серверної залежності в замиканні', () => {
    expect(violations).toEqual([]);
  });

  // Негативний контроль на КОЖНУ гілку детектора: файл `helper/b.ts` лежить
  // поза коренем скану і досяжний лише транзитивно.
  const BRANCHES: Array<[string, string, string]> = [
    ['node: префікс', `import { createHash } from 'node:crypto';`, 'node:'],
    [
      'голий вбудований модуль',
      `import { readFileSync } from 'fs';`,
      'builtin:',
    ],
    [
      'голий вбудований підшлях',
      `import { join } from 'path/posix';`,
      'builtin:',
    ],
    [
      'server-only субшлях',
      `import { sourceFieldHash } from 'simplycms/translations';`,
      'server-only:',
    ],
    [
      'серверна залежність',
      `import { Pool } from 'pg';`,
      'серверна залежність:',
    ],
  ];

  it.each(BRANCHES)(
    'негативний контроль: %s у ТРАНЗИТИВНОМУ імпорті',
    (_name, line, label) => {
      const found = scanFixture({
        'root/a.ts': `import { b } from '../helper/b';\nexport const a = b;\n`,
        'helper/b.ts': `${line}\nexport const b = 1;\n`,
      });
      expect(found.some((v) => v.startsWith(label))).toBe(true);
    },
  );

  it('негативний контроль: імпорт з розширенням `.js` не ховає замикання', () => {
    const found = scanFixture({
      'root/a.ts': `import { b } from '../helper/b.js';\nexport const a = b;\n`,
      'helper/b.ts': `import 'node:crypto';\nexport const b = 1;\n`,
    });
    expect(found.some((v) => v.startsWith('node:'))).toBe(true);
  });

  it('позитивний контроль: чисте дерево не дає порушень', () => {
    const found = scanFixture({
      'root/a.ts': `import { b } from '../helper/b';\nexport const a = b;\n`,
      'helper/b.ts': `export const b = 1;\n`,
    });
    expect(found).toEqual([]);
  });
});
