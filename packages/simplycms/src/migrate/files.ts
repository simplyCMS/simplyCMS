import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MigrationTransactionControlError } from './errors';
import { findTransactionControl } from './transaction-control';

/** Файл міграції теки: ім'я, шлях і сума нормалізованого вмісту. */
export type MigrationFile = { name: string; path: string; checksum: string };

/**
 * Вміст файлу з нормалізованими кінцями рядків (Е8-О4). Той самий файл,
 * витягнутий git-ом на Windows із `\r\n`, мусить мати ту саму суму, інакше
 * кожен старт там падав би `MigrationChecksumError` на чистому місці.
 */
export function readMigrationSql(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

/** sha256 hex нормалізованого вмісту — те, що лягає в журнал. */
export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

/**
 * `*.sql` теки (без підтек — `demo/` не міграція), відсортовані за іменем:
 * порядок імен і є порядком накату. Кожен файл перевіряється на керування
 * транзакцією ТУТ, до будь-якого з'єднання з БД (Е8-О3): поганий файл
 * зупиняє накат цілком, а не посередині.
 *
 * @throws MigrationTransactionControlError
 */
export function listMigrationFiles(dir: string): MigrationFile[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const path = join(dir, name);
      const sql = readMigrationSql(path);
      const reason = findTransactionControl(sql);
      if (reason) throw new MigrationTransactionControlError(name, reason);
      return { name, path, checksum: checksumOf(sql) };
    });
}
