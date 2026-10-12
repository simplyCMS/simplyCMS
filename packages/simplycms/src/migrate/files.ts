import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MigrationTransactionControlError,
  type TransactionControlReason,
} from './errors';

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

/**
 * Перший верхньорівневий стейтмент, що керує транзакцією сам, або `null`.
 * Тіла `$$…$$` (функції, `do`-блоки), коментарі, рядки й лапковані
 * ідентифікатори вирізаються до аналізу: `begin … end` у plpgsql — не
 * транзакція. Відоме обмеження: SQL-стандартне тіло `begin atomic … end`
 * поза `$$` дасть хибне `commit` — гучна відмова, а не тихий пропуск.
 */
export function findTransactionControl(
  sql: string,
): TransactionControlReason | null {
  for (const raw of stripNonCode(sql).split(';')) {
    const statement = raw.trim().toLowerCase();
    if (/\bconcurrently\b/.test(statement)) return 'concurrently';
    if (/^(begin|start\s+transaction)\b/.test(statement)) return 'begin';
    // `end`/`rollback`/`abort` закривають транзакцію так само, як `commit`;
    // `rollback to savepoint` лишається всередині неї.
    if (/^(commit|end|abort)\b/.test(statement)) return 'commit';
    if (/^rollback\b(?!\s+to\b)/.test(statement)) return 'commit';
  }
  return null;
}

const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

/** Замінює коментарі, рядки, `"ідентифікатори"` і `$tag$…$tag$` пробілом. */
function stripNonCode(sql: string): string {
  let out = '';
  let i = 0;
  const skipTo = (end: number) => {
    i = end;
    out += ' ';
  };
  while (i < sql.length) {
    const rest = sql.slice(i, i + 2);
    if (rest === '--') {
      const end = sql.indexOf('\n', i);
      skipTo(end === -1 ? sql.length : end);
    } else if (rest === '/*') {
      skipTo(blockCommentEnd(sql, i));
    } else if (sql[i] === "'" || sql[i] === '"') {
      skipTo(quotedEnd(sql, i));
    } else if (sql[i] === '$' && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? '')) {
      const tag = DOLLAR_TAG.exec(sql.slice(i))?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        skipTo(end === -1 ? sql.length : end + tag.length);
      } else out += sql[i++];
    } else out += sql[i++];
  }
  return out;
}

/** Кінець блочного коментаря; у Postgres вони вкладені. */
function blockCommentEnd(sql: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < sql.length) {
    const pair = sql.slice(i, i + 2);
    if (pair === '/*') depth += 1;
    else if (pair === '*/') depth -= 1;
    else {
      i += 1;
      continue;
    }
    i += 2;
    if (depth === 0) return i;
  }
  return sql.length;
}

/**
 * Кінець `'рядка'` чи `"ідентифікатора"`: подвоєна лапка — екранування.
 * Для `E'…'` зворотна коса риска теж екранує.
 */
function quotedEnd(sql: string, start: number): number {
  const quote = sql[start];
  const backslash = quote === "'" && /[eE]/.test(sql[start - 1] ?? '');
  let i = start + 1;
  while (i < sql.length) {
    if (backslash && sql[i] === '\\') i += 2;
    else if (sql[i] === quote && sql[i + 1] === quote) i += 2;
    else if (sql[i] === quote) return i + 1;
    else i += 1;
  }
  return sql.length;
}
