// Пароль app_runtime (Е8-О2, Р15) без БД: розбір URL як у `pg`, алфавіт
// пароля, верифікатор замість відкритого тексту і помилка без тексту запиту.
// Правильність самої математики SCRAM доводить оракул-тест проти Postgres
// (`test-harness/pg/__tests__/migrate-password.test.ts`), не цей файл.
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import {
  parseRuntimeCredentials,
  syncRuntimePassword,
} from '../runtime-password';

const url = (user: string, password: string) =>
  `postgres://${user}:${password}@db.example.test:5432/shop`;

/** Клієнт-шпигун: збирає SQL; `fail` — помилка, яку поверне запит. */
const fakeClient = (fail?: Error) => {
  const sql: string[] = [];
  const client = {
    query: async (text: string) => {
      sql.push(text);
      if (fail) throw fail;
      return { rows: [] };
    },
    escapeLiteral: (s: string) => `'${s.replace(/'/g, "''")}'`,
  } as unknown as pg.ClientBase;
  return { client, sql };
};

describe('parseRuntimeCredentials', () => {
  it.each([
    ['N3w-P%40ss', 'N3w-P@ss'],
    // Голий `%` `pg` з'єднує (pg-connection-string спершу робить encodeURI).
    ['p%zz', 'p%zz'],
    ['100%', '100%'],
    ['with space', 'with space'],
  ])('пароль у URL %j → %j', (raw, password) => {
    expect(parseRuntimeCredentials(url('app_runtime', raw))).toEqual({
      password,
    });
  });

  it('інший користувач чи порожній пароль → нічого не синхронізувати', () => {
    expect(parseRuntimeCredentials(url('owner', 'x'))).toEqual({
      skip: 'інший користувач',
    });
    expect(
      parseRuntimeCredentials('postgres://app_runtime@db.example.test/shop'),
    ).toEqual({ skip: 'його немає в URL' });
  });

  it('не-ASCII пароль → помилка про алфавіт без значення пароля', () => {
    const password = 'Пароль-ä1';
    const encoded = encodeURIComponent(password);
    let message = '';
    try {
      parseRuntimeCredentials(url('app_runtime', encoded));
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('друкованих ASCII');
    expect(message).not.toContain(password);
    expect(message).not.toContain(encoded);
  });

  it('некоректний URL → помилка без рядка підключення', () => {
    expect(() => parseRuntimeCredentials('не url S3cr3t')).toThrow(
      /^\[simplycms\/migrate\] runtimeUrl: не є коректним URL підключення$/,
    );
  });
});

describe('syncRuntimePassword', () => {
  it('на сервер іде верифікатор SCRAM, а не пароль', async () => {
    const { client, sql } = fakeClient();
    const lines: string[] = [];
    const synced = await syncRuntimePassword(
      client,
      { password: 'N3w-P@ss' },
      (line) => lines.push(line),
    );
    expect(synced).toBe(true);
    // Перед записом — лише читання (чи пароль уже той самий, R2-4); запис — один.
    const alter = sql.filter((q) => /^alter role/.test(q));
    expect(alter).toHaveLength(1);
    expect(alter[0]).toMatch(
      /^alter role app_runtime password 'SCRAM-SHA-256\$4096:[^$]+\$[^:]+:[^']+'$/,
    );
    for (const q of sql) expect(q).not.toContain('N3w-P@ss');
    expect(lines.join('\n')).not.toContain('N3w-P@ss');
  });

  it('помилка запиту не несе ні тексту запиту, ні верифікатора', async () => {
    const leak = Object.assign(
      new Error('syntax error at or near "SCRAM-SHA-256$4096:abc"'),
      { code: '42601', query: 'alter role … SCRAM-SHA-256$…' },
    );
    const { client } = fakeClient(leak);
    const err = await syncRuntimePassword(
      client,
      { password: 'N3w-P@ss' },
      () => {},
    ).catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('42601');
    expect((err as Error).message).not.toMatch(/SCRAM|N3w-P@ss/);
    expect((err as Error).cause).toBeUndefined();
  });
});
