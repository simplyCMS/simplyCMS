import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';

const STOREFRONT = resolve(
  import.meta.dirname,
  '../packages/simplycms/src/storefront',
);

/**
 * Хто в `src/storefront` сміє імпортувати порт сховища.
 *
 * 🔴 Існує тому, що тір-зона не вміє бути вужчою за теку: виняток
 * `storefront: ['db','auth','storage']` (рішення Е2-12) технічно відкриває
 * `simplycms/storage` УСІЙ теці `src/storefront/**` (наприклад,
 * `storefront/seo/**`), хоч намір — рівно `loaders/avatar.ts`. Без цього
 * піна наступний етап побачив би відкритий виняток і вважав би файлову
 * систему нормою будь-де в `storefront` — мовчки, бо жоден гейт не червонів
 * би. Сканується тека ЦІЛКОМ (а не лише `loaders/`) — саме звуження на
 * `loaders/` і пропустило `seo/` повз пін.
 *
 * 🔴 Список може тільки СКОРОЧУВАТИСЬ або рости РІШЕННЯМ, а не звичкою:
 * новий запис тут — це заявка на те, що ще один файл вітрини працює з
 * файлами, і вона мусить пройти рев'ю як рішення, а не проїхати в дифі.
 */
const ALLOWED = [
  'loaders/avatar.ts',
  // Е6д-15 (аудит Codex р1 B4): другий споживач порту з вітрини — фото
  // відгуку (Д-3): подача пише файли, видалення власного відгуку їх стирає.
  'loaders/reviews-write.ts',
  // Е6д-21: лише ТИП `MediaServeVerdict` — вердикт роздачі; файлів модуль не
  // торкається, а `storage` не знає про вітрину, тож тип живе в порту.
  'media-visibility.ts',
] as const;

const IMPORTS_PORT = /from\s+['"]simplycms\/storage['"]/;

describe('споживачі порту сховища в src/storefront', () => {
  const consumers = sourceFiles(STOREFRONT)
    .filter((file) => IMPORTS_PORT.test(readFileSync(file, 'utf8')))
    .map((file) => relative(STOREFRONT, file).replaceAll('\\', '/'));

  it('порт імпортують рівно дозволені файли', () => {
    expect(
      consumers.filter((f) => !ALLOWED.includes(f as never)),
      'новий файл вітрини працює з файлами — це рішення, а не деталь: додай його в ALLOWED свідомо',
    ).toEqual([]);
  });

  it('у списку немає мертвих записів', () => {
    expect(
      ALLOWED.filter((f) => !consumers.includes(f)),
      'файл більше не імпортує порт — прибери його зі списку',
    ).toEqual([]);
  });
});
