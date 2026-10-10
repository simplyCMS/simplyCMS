import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';
import { MUTATION_CACHE_SYNC_RATCHET } from '../eslint.config.mjs';

/**
 * Повнота ратчету `mutation-cache-sync` (борг Е3 з `test-contours.md` §12):
 * кожен файл `src/admin/**`, що імпортує serverFn чи колекції адмінки,
 * мусить бути в зоні правила `simplycms-cache-sync/mutation-cache-sync` —
 * або під `admin/features/**` (у зоні за побудовою), або в
 * `MUTATION_CACHE_SYNC_RATCHET`, або в `EXEMPT` з причиною. Інакше
 * сторінка, переписана хвилею Е4–Е6 поза `features/`, мовчки лишилась би
 * без гейта — зелений `pnpm lint` довів би не повноту зони, а лише те, що
 * файли, які туди потрапили, чисті.
 *
 * 🔴 Не глобить `tinyglobby` (у devDependencies немає) — той самий
 * рекурсивний сканер `.ts(x)`, що і в `tests/explicit-ids.test.ts` /
 * `tests/admin-inserts-need-id.test.ts` (`insert-scan.ts`), щоб не заводити
 * другий спосіб обходу дерева.
 */

const ROOT = resolve(import.meta.dirname, '../packages/simplycms/src/admin');
const ROOT_REL = 'packages/simplycms/src/admin';
const IMPORT_RE = /from ['"]simplycms\/admin-(?:data|server)/;

// Єдина виїмка: сховище файлів, не сутність кешу з write-back-хендлером —
// результат (референс медіа) іде у стан ФОРМИ власника, не в колекцію.
const EXEMPT: Readonly<Record<string, string>> = {
  'packages/simplycms/src/admin/components/ImageUpload.tsx':
    'сховище файлів, не сутність кешу: результат — референс у стан форми власника',
};

function isUnderRatchetOrFeatures(fileRel: string): boolean {
  return (
    fileRel.startsWith('packages/simplycms/src/admin/features/') ||
    MUTATION_CACHE_SYNC_RATCHET.includes(fileRel)
  );
}

const allFiles = sourceFiles(ROOT).filter((f) => !f.includes('__tests__'));
const users = allFiles
  .map((f) => `${ROOT_REL}/${relative(ROOT, f)}`)
  .filter((fileRel) => {
    const abs = resolve(import.meta.dirname, '..', fileRel);
    return IMPORT_RE.test(readFileSync(abs, 'utf8'));
  });

describe('повнота зони mutation-cache-sync', () => {
  it('скан узагалі щось знаходить — інакше гейт зелений через поламаний скан', () => {
    expect(users.length).toBeGreaterThan(0);
  });

  it('кожен споживач серверного шару — у зоні правила', () => {
    const outside = users.filter(
      (f) => !isUnderRatchetOrFeatures(f) && !(f in EXEMPT),
    );
    expect(outside).toEqual([]);
  });

  it('ратчет і виїмки без мертвих записів', () => {
    for (const f of [...MUTATION_CACHE_SYNC_RATCHET, ...Object.keys(EXEMPT)])
      expect(users, `${f} не споживає simplycms/admin-(data|server)`).toContain(
        f,
      );
  });
});
