import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/server-fn-top-level.mjs';

const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { s: { rules: { 'server-fn-top-level': rule } } },
    rules: { 's/server-fn-top-level': 'error' },
  },
];
const lint = (code: string) =>
  linter.verify(
    `import { createServerFn } from '@tanstack/react-start';\n${code}`,
    config,
    { filename: 'f.ts' },
  );

describe('server-fn-top-level (К3-4′)', () => {
  it.each([
    [
      'export const chain',
      `export const list = createServerFn({ method: 'GET' }).validator(s).handler(h);`,
    ],
    [
      'const без export',
      `const list = createServerFn({ method: 'GET' }).handler(h);`,
    ],
  ])('легально: %s', (_n, code) => expect(lint(code)).toEqual([]));

  it.each([
    [
      'усередині функції',
      `function f() { const x = createServerFn({ method: 'GET' }).handler(h); return x; }`,
    ],
    ['let', `let y = createServerFn({ method: 'GET' }).handler(h);`],
    [
      'object property',
      `const o = { fn: createServerFn({ method: 'GET' }).handler(h) };`,
    ],
    [
      'wrapper-call',
      `const w = wrap(createServerFn({ method: 'GET' }).handler(h));`,
    ],
    [
      'Promise.resolve',
      `const pr = Promise.resolve(createServerFn({ method: 'GET' }).handler(h));`,
    ],
    [
      'export default',
      `export default createServerFn({ method: 'GET' }).handler(h);`,
    ],
    [
      'trailing call',
      `const t = createServerFn({ method: 'GET' }).handler(h)();`,
    ],
  ])('офендер: %s', (_n, code) => {
    const msgs = lint(code);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('notTopLevel');
  });

  it('аліас імпорту не обходить правило', () => {
    const msgs = linter.verify(
      `import { createServerFn as mk } from '@tanstack/react-start';\nconst o = { fn: mk({ method: 'GET' }).handler(h) };`,
      config,
      { filename: 'f.ts' },
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.messageId).toBe('notTopLevel');
  });

  it('namespace-імпорт і перепризначення не обходять правило', () => {
    const ns = linter.verify(
      `import * as rs from '@tanstack/react-start';\nconst o = { fn: rs.createServerFn().handler(h) };`,
      config,
      { filename: 'f.ts' },
    );
    expect(ns).toHaveLength(1);
    const re = linter.verify(
      `import { createServerFn } from '@tanstack/react-start';\nconst w = createServerFn;\nfunction f() { return w().handler(h); }`,
      config,
      { filename: 'f.ts' },
    );
    expect(re).toHaveLength(1);
  });

  // Пункт 10.1 Task 18: природні рефакторинги не виводять виклик з-під правила.
  const raw = (code: string) =>
    linter.verify(code, config, { filename: 'f.ts' });

  it.each([
    [
      'простий реекспорт',
      `export { createServerFn } from '@tanstack/react-start';`,
    ],
    [
      'реекспорт з перейменуванням',
      `export { createServerFn as csf } from '@tanstack/react-start';`,
    ],
    ['export * з модуля Start', `export * from '@tanstack/react-start';`],
    [
      'export * as з модуля Start',
      `export * as rs from '@tanstack/react-start';`,
    ],
    [
      'реекспорт імпортованого імені',
      `import { createServerFn as mk } from '@tanstack/react-start';\nexport { mk };`,
    ],
  ])('реекспорт — офендер: %s', (_n, code) => {
    const msgs = raw(code);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.messageId).toBe('reexport');
  });

  it('реекспорт інших імен Start і createServerFn з чужого модуля — не офендер', () => {
    expect(raw(`export { createStart } from '@tanstack/react-start';`)).toEqual(
      [],
    );
    expect(raw(`export { createServerFn } from './local';`)).toEqual([]);
  });

  it.each([
    [
      'let-аліас',
      `import { createServerFn } from '@tanstack/react-start';\nlet f = createServerFn;\nconst o = { fn: f().handler(h) };`,
    ],
    [
      'присвоєння після оголошення',
      `import { createServerFn } from '@tanstack/react-start';\nlet f;\nf = createServerFn;\nconst o = { fn: f().handler(h) };`,
    ],
    [
      'аліас з namespace',
      `import * as rs from '@tanstack/react-start';\nconst f = rs.createServerFn;\nconst o = { fn: f().handler(h) };`,
    ],
  ])('аліас присвоєнням — трекер бачить виклик: %s', (_n, code) => {
    const msgs = raw(code);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.messageId).toBe('notTopLevel');
  });
});
