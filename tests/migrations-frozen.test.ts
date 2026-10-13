// Заморожені міграції rc.1 (К3-Е8): файли `0000…0005` не правляться НІКОЛИ.
// Магазин, що вже накотив їх, має в журналі ці суми, і будь-яка правка дала б
// `MigrationChecksumError` на старті контейнера. Нова схема — лише нові файли
// `0006_*` і далі (кожен несе свої гранти й RLS у собі).
//
// `FROZEN` охоплює ВСІ міграції, що їдуть у rc.1, а множина файлів канону мусить
// збігатися з його ключами: новий файл поза списком — червоний тест, а не
// мовчки нестережений. Додаючи `0006_*`, його суму вносять у `FROZEN` в тому ж
// коміті — відтоді він заморожений для наступного релізу.
//
// Суми — ті самі, що пише журнал (`listMigrationFiles`: sha256 після
// нормалізації CRLF→LF).
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listMigrationFiles } from 'simplycms/migrate';

const FROZEN: Readonly<Record<string, string>> = {
  '0000_prelude.sql':
    '62f6ddf0b4ca251d6e9df5e62e85f4d86b84ab07961eec309020ad4b7d087a93',
  '0001_init.sql':
    'b53cc31a3bb4e85297e5d80177738133b3e65ea1f06c0dfa24c1ae69a221b25c',
  '0002_grants.sql':
    '74329ba15eb31b5b22349a2c29d01250bbd134cafe34204661037653dd4a83a0',
  '0003_seed.sql':
    '37543db40a34793b2514ddba68d65117203cfed87d420f64afb61d6520000a21',
  '0004_functions.sql':
    '5cbf88a4e424de43b1cf6c48d76a0f39daeb0330df8a7b041bb9dcb99ee67230',
  '0005_mail_outbox.sql':
    '62faaf68e4f5eff44ffb2cedc06af03763ba0b163584ed00f4ef1d221996bc0f',
};

const ROOT = join(import.meta.dirname, '..');

/** Канон ядра і його синхронізована копія в шаблоні магазину. */
const DIRS = [
  'packages/simplycms/migrations',
  'packages/create-simplycms-store/template/db/migrations',
];

describe('заморожені міграції rc.1', () => {
  it.each(DIRS)('%s: множина файлів і суми збігаються з FROZEN', (dir) => {
    // Без фільтра за ключами FROZEN: зайвий файл має валити тест.
    const actual = Object.fromEntries(
      listMigrationFiles(join(ROOT, dir)).map((file) => [
        file.name,
        file.checksum,
      ]),
    );
    expect(actual).toEqual(FROZEN);
  });
});
