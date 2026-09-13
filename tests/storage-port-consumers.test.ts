import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { sourceFiles } from '../packages/simplycms/test-harness/pg/insert-scan';

const LOADERS = resolve(
  import.meta.dirname,
  '../packages/simplycms/src/storefront/loaders',
);

/**
 * Хто з лоадерів вітрини сміє імпортувати порт сховища.
 *
 * 🔴 Існує тому, що тір-зона не вміє бути вужчою за теку: виняток
 * `storefront: ['db','auth','storage']` (рішення Е2-12) технічно відкриває
 * `simplycms/storage` всім лоадерам, хоч намір — рівно `avatar.ts`. Без
 * цього піна наступний етап побачив би відкритий виняток і вважав би
 * файлову систему в лоадерах нормою — мовчки, бо жоден гейт не червонів би.
 *
 * 🔴 Список може тільки СКОРОЧУВАТИСЬ або рости РІШЕННЯМ, а не звичкою:
 * новий запис тут — це заявка на те, що ще один лоадер працює з файлами,
 * і вона мусить пройти рев'ю як рішення, а не проїхати в дифі.
 */
const ALLOWED = ['avatar.ts'] as const;

const IMPORTS_PORT = /from\s+['"]simplycms\/storage['"]/;

describe('споживачі порту сховища серед лоадерів вітрини', () => {
  const consumers = sourceFiles(LOADERS)
    .filter((file) => IMPORTS_PORT.test(readFileSync(file, 'utf8')))
    .map((file) => relative(LOADERS, file).replaceAll('\\', '/'));

  it('порт імпортують рівно дозволені лоадери', () => {
    expect(
      consumers.filter((f) => !ALLOWED.includes(f as never)),
      'новий лоадер працює з файлами — це рішення, а не деталь: додай його в ALLOWED свідомо',
    ).toEqual([]);
  });

  it('у списку немає мертвих записів', () => {
    expect(
      ALLOWED.filter((f) => !consumers.includes(f)),
      'лоадер більше не імпортує порт — прибери його зі списку',
    ).toEqual([]);
  });
});
