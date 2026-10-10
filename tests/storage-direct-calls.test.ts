import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';

const SRC = resolve(import.meta.dirname, '../packages/simplycms/src');

/**
 * Ратчет прямих викликів сховища поза портом `simplycms/storage`.
 *
 * 🔴 Список виїмок порожній (легасі `ReviewDetail.tsx` переписано в Е6д) і
 * може лише зростати свідомим рішенням з причиною біля запису.
 *
 * 🔴 Тест дублює лінт-правило навмисно: правило бачить лише те, що ESLint
 * парсить у своїй зоні, а цей скан ходить по ФАЙЛАХ — тож новий виклик у
 * теці, яку зона колись перестане покривати, не проскочить мовчки.
 */
export const STORAGE_DIRECT_CALL_EXEMPTIONS: readonly string[] = [];

const DIRECT_CALL = /\.storage\.from\(|supabase\.storage|@supabase\/storage-js/;

describe('прямі виклики сховища поза портом', () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => DIRECT_CALL.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).replaceAll('\\', '/'));

  it('поза списком виїмок прямих викликів немає', () => {
    expect(
      offenders.filter((f) => !STORAGE_DIRECT_CALL_EXEMPTIONS.includes(f)),
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
