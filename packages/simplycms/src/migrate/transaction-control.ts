import type { TransactionControlReason } from './errors';

// Сканер керування транзакцією у файлі міграції (Е8-О3). Окремо від переліку
// файлів: перелік і сума — про ідентичність файлу, сканер — про те, чи можна
// його виконати в транзакції накату.

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
