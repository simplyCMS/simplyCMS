import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';

const SRC = resolve(import.meta.dirname, '../packages/simplycms/src');

/**
 * Ратчет прямих викликів сховища поза портом `simplycms/storage`.
 *
 * 🔴 Список може тільки СКОРОЧУВАТИСЬ. `ReviewDetail.tsx` лишається тут не
 * тому, що виклик правильний, а тому, що сторінка цілком мертва: вона читає
 * й пише через `supabase-js` і на чистому Postgres не працює. Її перепише
 * хвиля відгуків (Е4–Е6) разом із цим викликом. Переписати її «заодно» в Е2
 * означало б тягнути в storage-етап половину хвилі сутностей.
 *
 * 🔴 Тест дублює лінт-правило навмисно: правило бачить лише те, що ESLint
 * парсить у своїй зоні, а цей скан ходить по ФАЙЛАХ — тож новий виклик у
 * теці, яку зона колись перестане покривати, не проскочить мовчки.
 */
export const STORAGE_DIRECT_CALL_EXEMPTIONS = [
  'admin/pages/ReviewDetail.tsx',
] as const;

const DIRECT_CALL = /\.storage\.from\(|supabase\.storage|@supabase\/storage-js/;

describe('прямі виклики сховища поза портом', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => DIRECT_CALL.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).replaceAll('\\', '/'));

  it('поза списком виїмок прямих викликів немає', () => {
    expect(
      offenders.filter(
        (f) => !STORAGE_DIRECT_CALL_EXEMPTIONS.includes(f as never),
      ),
      'новий прямий виклик сховища — використай simplycms/storage через serverFn',
    ).toEqual([]);
  });

  it('список виїмок не містить мертвих записів', () => {
    expect(
      STORAGE_DIRECT_CALL_EXEMPTIONS.filter((f) => !offenders.includes(f)),
      'файл переписано — прибери його зі списку, список лише скорочується',
    ).toEqual([]);
  });
});
