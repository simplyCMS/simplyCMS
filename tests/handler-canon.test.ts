import { describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * Канон persistence-хендлерів (onInsert/onUpdate/onDelete) у `admin-data`:
 * хендлер ПОВЕРТАЄ результат сервера в кеш колекції — `await`-нутий
 * write-back (`utils.write*` або `utils.writeBatch(cb)` з write*-викликом
 * у cb) на КОЖНОМУ шляху завершення.
 *
 * 🔴 Чому інваріант тримає саме хендлер: поля, які рахує сервер
 * (`createdAt`, `version`, `sort_order`, нормалізований slug, проєкції
 * перекладів), оптимістичний драфт не знає. Ревалідації після запису
 * немає (TanStack DB 1.0 / query-db-collection 1.5 — M1 TSDB-1 закрито),
 * тож без write-back у кеші лишилося б оптимістичне значення.
 * `await` обовʼязковий: `write*` повертають Promise, і без нього помилка
 * запису губиться, а `tx.when('settled')` може резолвитись раніше, ніж
 * кеш прийняв рядок сервера.
 *
 * Path-sensitive рівно настільки:
 * - write-back має бути БЕЗУМОВНИМ statement-ом тіла хендлера (у гілці
 *   `if` чи циклі він не покриває всі шляхи);
 * - кожен `return` у тілі (поза вкладеними функціями) мусить мати такий
 *   write-back серед попередніх сиблінгів свого ланцюжка блоків.
 * Виняток — коментар `// canon-exempt: <причина>` рядком вище хендлера.
 * BASELINE порожній і лишається порожнім: гейт постійний. Що сервер
 * повертає ПОВНИЙ змінений набір рядків, сканер не бачить — це доводять
 * поведінкові тести колекцій (серверне поле в кеші після `when('settled')`).
 */
const ROOT = join(import.meta.dirname, '../packages/simplycms/src/admin-data');
const HANDLERS = new Set(['onInsert', 'onUpdate', 'onDelete']);
const WRITE_OPS = new Set([
  'writeUpsert',
  'writeUpdate',
  'writeInsert',
  'writeDelete',
]);

function* tsFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== '__tests__') yield* tsFiles(p);
    else if (e.isFile() && /\.tsx?$/.test(e.name)) yield p;
  }
}

function offendersIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const out: string[] = [];

  /**
   * Opt-out `// canon-exempt: <причина>` — РІВНО рядком вище вузла
   * (сирий пошук по сусідніх рядках глушив би детекцію коментарем за три
   * рядки вище; механіка та сама, що hasExempt у mutation-cache-sync).
   */
  const hasExempt = (node: ts.Node): boolean => {
    const ranges = ts.getLeadingCommentRanges(src, node.getFullStart()) ?? [];
    const last = ranges[ranges.length - 1];
    if (!last) return false;
    const text = src
      .slice(last.pos, last.end)
      .replace(/^\/\/|^\/\*|\*\/$/g, '');
    const commentEndLine = sf.getLineAndCharacterOfPosition(last.end).line;
    const stmtLine = sf.getLineAndCharacterOfPosition(node.getStart()).line;
    return (
      /^\s*canon-exempt:\s*\S/.test(text) && commentEndLine === stmtLine - 1
    );
  };

  /** Чи є в піддереві фактичний CallExpression `<x>.write*(…)`. */
  const containsWriteCall = (n: ts.Node): boolean => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      WRITE_OPS.has(n.expression.name.text)
    )
      return true;
    return ts.forEachChild(n, containsWriteCall) ?? false;
  };

  /**
   * Statement — справжній write-back: `await <x>.write*(…)` або
   * `await <x>.writeBatch(cb)`, чий callback САМ містить write*-виклик.
   * Порожній batch чи виклик без `await` — не write-back (за AST, не
   * regex: слово в коментарі чи рядку не рахується).
   */
  const isRealWrite = (st: ts.Statement): boolean => {
    if (!ts.isExpressionStatement(st) || !ts.isAwaitExpression(st.expression))
      return false;
    const call = st.expression.expression;
    if (
      !ts.isCallExpression(call) ||
      !ts.isPropertyAccessExpression(call.expression)
    )
      return false;
    const name = call.expression.name.text;
    if (WRITE_OPS.has(name)) return true;
    if (name === 'writeBatch') {
      const cb = call.arguments[0];
      return !!cb && containsWriteCall(cb);
    }
    return false;
  };

  const precededByWrite = (node: ts.Node, body: ts.Block): boolean => {
    let cur: ts.Node = node;
    while (cur !== body && cur.parent) {
      const parent = cur.parent;
      if (ts.isBlock(parent)) {
        for (const st of parent.statements) {
          if (st === cur) break;
          if (isRealWrite(st)) return true;
        }
      }
      cur = parent;
    }
    return false;
  };

  const report = (n: ts.Node) =>
    out.push(
      `${relative(process.cwd(), file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
    );

  const isFn = (n: ts.Node) =>
    ts.isArrowFunction(n) ||
    ts.isFunctionExpression(n) ||
    ts.isFunctionDeclaration(n) ||
    ts.isMethodDeclaration(n);

  const checkHandler = (handler: ts.Node, body: ts.ConciseBody) => {
    if (hasExempt(handler)) return;
    // Concise-arrow — тіло-вираз, місця для write-back statement-а немає.
    if (!ts.isBlock(body)) return report(body);
    if (!body.statements.some(isRealWrite)) return report(handler);
    const walk = (n: ts.Node) => {
      if (isFn(n)) return; // return вкладеної функції — не шлях хендлера
      if (ts.isReturnStatement(n) && !precededByWrite(n, body)) report(n);
      ts.forEachChild(n, walk);
    };
    body.statements.forEach(walk);
  };

  const visit = (n: ts.Node) => {
    if (
      (ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n)) &&
      HANDLERS.has(n.name.getText())
    ) {
      const fn = ts.isPropertyAssignment(n) ? n.initializer : n;
      if (
        (ts.isArrowFunction(fn) ||
          ts.isFunctionExpression(fn) ||
          ts.isMethodDeclaration(fn)) &&
        fn.body
      )
        checkHandler(n, fn.body);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Одноразовий .ts-фікстур для юніт-тестів `offendersIn` напряму, без
 * торкання реальних колекцій — негативні контролі кожної гілки сканера.
 */
function withFixture(lines: string[], run: (file: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'handler-canon-'));
  const file = join(dir, 'fixture.ts');
  writeFileSync(file, [...lines, ''].join('\n'), 'utf8');
  try {
    run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const handler = (body: string[]) => [
  'export const c = {',
  '  onUpdate: async ({ transaction }) => {',
  '    const rows = await update(transaction);',
  ...body.map((l) => `    ${l}`),
  '  },',
  '};',
];

describe('handler-canon: хендлер повертає рядок сервера в кеш', () => {
  it('офендерів немає (BASELINE порожній назавжди)', () => {
    const offenders = [...tsFiles(ROOT)].flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });

  it('await writeBatch з write*-викликом — канон; await write* напряму — теж', () => {
    withFixture(
      handler([
        'await c.utils.writeBatch(() => {',
        '  for (const r of rows) c.utils.writeUpsert(r);',
        '});',
      ]),
      (file) => expect(offendersIn(file)).toEqual([]),
    );
    withFixture(handler(['await c.utils.writeDelete(rows[0].id);']), (file) =>
      expect(offendersIn(file)).toEqual([]),
    );
  });

  it('офендер: без write-back, без await, лише в гілці if, порожній batch', () => {
    for (const body of [
      [],
      ['c.utils.writeBatch(() => { c.utils.writeUpsert(rows[0]); });'],
      ['if (rows.length) await c.utils.writeUpsert(rows[0]);'],
      ['await c.utils.writeBatch(() => {});'],
      ['// await c.utils.writeUpsert(rows[0]);'],
    ])
      withFixture(handler(body), (file) =>
        expect(offendersIn(file), body.join(' ')).toHaveLength(1),
      );
  });

  it('офендер: ранній return до write-back; return вкладеної функції — ні', () => {
    withFixture(
      handler([
        'if (!rows.length) return;',
        'await c.utils.writeUpsert(rows[0]);',
      ]),
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
    withFixture(
      handler([
        'await c.utils.writeBatch(() => {',
        '  rows.forEach((r) => { if (!r) return; c.utils.writeUpsert(r); });',
        '});',
        'return;',
      ]),
      (file) => expect(offendersIn(file)).toEqual([]),
    );
  });

  it('concise-arrow — офендер за побудовою (write-back неможливий у виразі)', () => {
    withFixture(
      ['export const c = {', '  onDelete: async () => remove(),', '};'],
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
  });
});

describe('canon-exempt: заякорений рядком вище хендлера, з причиною', () => {
  const exempt = (comment: string[]) => [
    'export const c = {',
    ...comment,
    '  onDelete: async () => {',
    '    await remove();',
    '  },',
    '};',
  ];

  it('директива РІВНО рядком вище — офендера немає', () => {
    withFixture(exempt(['  // canon-exempt: тестова причина']), (file) =>
      expect(offendersIn(file)).toEqual([]),
    );
  });

  it('директива за три рядки вище, і окремо — без причини: офендер в обох випадках', () => {
    withFixture(
      exempt(['  // canon-exempt: тестова причина', '', '']),
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
    withFixture(exempt(['  // canon-exempt:']), (file) =>
      expect(offendersIn(file)).toHaveLength(1),
    );
  });
});
