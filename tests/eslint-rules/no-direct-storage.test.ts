import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import rule from '../../eslint-rules/no-direct-storage.mjs';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    plugins: { s: { rules: { 'no-direct-storage': rule } } },
    rules: { 's/no-direct-storage': 'error' },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  });

describe('no-direct-storage', () => {
  it.each([
    [
      'прямий supabase.storage',
      'await supabase.storage.from("b").remove([k]);',
    ],
    ['через змінну', 'const c = get(); c.storage.from("b").upload(k, f);'],
    ['обчислений доступ', 'const c = get(); c["storage"].from("b");'],
    ['імпорт storage-js', 'import { X } from "@supabase/storage-js";'],
  ])('валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(1);
  });

  it.each([
    ['порт', 'import { writeMedia } from "simplycms/storage";'],
    ['serverFn адмінки', 'await uploadMedia({ data: body });'],
    ['рядок "storage" як значення', 'const kind = "storage";'],
    ['чужа таблиця БД', 'await db.select().from(media);'],
  ])('не валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(0);
  });
});
