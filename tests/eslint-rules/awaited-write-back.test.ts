import { resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/awaited-write-back.mjs';

// Негативний контроль правила awaited-write-back: загублений Promise
// write-back-у (TanStack DB 1.0) ховає помилку запису і пускає код далі
// раніше, ніж кеш прийняв рядок сервера.

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { s: { rules: { 'awaited-write-back': rule } } },
    rules: { 's/awaited-write-back': 'error' },
  },
];
const lint = (code: string) =>
  linter.verify(code, config, { filename: resolve(REPO, 'probe.ts') });
const ids = (code: string) => lint(code).map((m) => [m.ruleId, m.messageId]);

describe('awaited-write-back', () => {
  it.each([
    [
      'голий writeBatch',
      `async function f() { c.utils.writeBatch(() => {}); }`,
    ],
    ['голий writeDelete', `async function f() { c.utils.writeDelete(id); }`],
    [
      'writeUpsert на ланцюжку ref',
      `async function f() { ref.current!.utils.writeUpsert(row); }`,
    ],
    [
      'void без причини',
      `async function f() {\n  void c.utils.writeUpsert(row);\n}`,
    ],
    [
      'void з причиною НЕ рядком вище',
      `async function f() {\n  // write-back-void: причина\n\n  void c.utils.writeUpsert(row);\n}`,
    ],
    [
      'forEach з concise-стрілкою',
      `function f() { rows.forEach((r) => c.utils.writeUpsert(r)); }`,
    ],
    [
      'map з concise-стрілкою без Promise.all',
      `function f() { rows.map((r) => c.utils.writeUpsert(r)); }`,
    ],
    [
      'map у Promise.all, який не оброблено',
      `function f() { Promise.all(rows.map((r) => c.utils.writeUpsert(r))); }`,
    ],
    [
      'Promise у змінній без await',
      `async function f() { const p = c.utils.writeBatch(() => {}); }`,
    ],
  ])('ловить: %s', (_label, code) => {
    expect(ids(code)).toEqual([['s/awaited-write-back', 'floating']]);
  });

  it.each([
    [
      'await writeBatch',
      `async function f() { await c.utils.writeBatch(() => {}); }`,
    ],
    [
      'await на ланцюжку ref з non-null',
      `async function f() { await ref.current!.utils.writeDelete(id); }`,
    ],
    ['return', `function f() { return c.utils.writeUpsert(row); }`],
    ['окрема concise-стрілка', `const f = () => c.utils.writeDelete(id);`],
    [
      'map у await Promise.all',
      `async function f() { await Promise.all(rows.map((r) => c.utils.writeUpsert(r))); }`,
    ],
    [
      'map у return Promise.all',
      `function f() { return Promise.all(rows.map((r) => c.utils.writeUpsert(r))); }`,
    ],
    [
      'write* усередині callback-а writeBatch',
      `async function f() {\n  await c.utils.writeBatch(() => {\n    for (const r of rows) c.utils.writeUpsert(r);\n    c.utils.writeDelete(x);\n  });\n}`,
    ],
    [
      'void з причиною рядком вище',
      `async function f() {\n  // write-back-void: тест-причина\n  void c.utils.writeUpsert(row);\n}`,
    ],
    ['не utils', `async function f() { stream.writeUpsert(row); }`],
    ['інша операція utils', `async function f() { c.utils.refetch(); }`],
  ])('пропускає: %s', (_label, code) => {
    expect(lint(code)).toEqual([]);
  });
});
