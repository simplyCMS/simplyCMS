// С-10в: статус відповіді адмінки ставить МЕЖА — `runAdminTransactions`
// (`run.ts`) для помилок усередині операції і вхід serverFn (`validation.ts`:
// `adminInput`/`parseAdminInput` виконуються ДО межі). Ядро, що саме кличе
// `setResponseStatus`, падає поза HTTP-запитом (сід, порти, MCP-сервер
// магазину): справжня функція кидає «No StartEvent found». Тож будь-яке
// згадування ідентифікатора в коді `admin-server/**` поза allowlist —
// червоне, хоч би як його імпортували (іменовано, з `as`, через `* as`).
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(
  ['../../**/*.{ts,tsx}', '!../../**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Ключ glob (відносно `__tests__`) → шлях від `src/`: `admin-server/impl/…`. */
const rel = (key: string) =>
  new URL(key, 'file:///src/admin-server/impl/__tests__/').pathname.replace(
    '/src/',
    '',
  );

/** Межі, яким статус ставити дозволено (з причиною). */
const ALLOWED: Record<string, string> = {
  'admin-server/impl/run.ts':
    'межа операції: 409/400 для доменних помилок ДО повторного throw',
  'admin-server/impl/validation.ts':
    'вхід serverFn: Zod-відмова → 400 ще ДО runAdminTransactions',
};

/**
 * Чи є ідентифікатор у КОДІ (AST TypeScript): коментарі й рядки — не вузли
 * `Identifier`, тож згадка в доці не червонить, а regex-стрипер коментарів
 * помилявся на `/*` усередині рядкового коментаря і ховав живий код.
 */
const mentions = (path: string, src: string) => {
  const file = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, false);
  const visit = (node: ts.Node): boolean =>
    (ts.isIdentifier(node) && node.text === 'setResponseStatus') ||
    (ts.forEachChild(node, visit) ?? false);
  return visit(file);
};

const offenders = () =>
  Object.entries(sources)
    .filter(([path, src]) => mentions(path, src))
    .map(([path]) => rel(path));

describe('admin-server: setResponseStatus лише на межі (С-10)', () => {
  it('скан бачить файли admin-server (не порожній)', () => {
    expect(Object.keys(sources).map(rel)).toContain('admin-server/impl/run.ts');
  });

  it('ідентифікатор живе лише у файлах allowlist', () => {
    expect(offenders().filter((p) => !(p in ALLOWED))).toEqual([]);
  });

  it('коментар із `/*` не ховає код після себе (регресія стрипера)', () => {
    const src = '// glob product-modifications/*.ts\nsetResponseStatus(409);\n';
    expect(mentions('fixture.ts', src)).toBe(true);
    expect(
      mentions('doc.ts', '/** setResponseStatus */ // setResponseStatus'),
    ).toBe(false);
  });

  it('allowlist не застарів: кожна межа справді ставить статус', () => {
    const present = new Set(offenders());
    for (const p of Object.keys(ALLOWED)) expect(present.has(p), p).toBe(true);
  });
});
