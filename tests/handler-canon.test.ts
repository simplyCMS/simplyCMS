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
 * Кожен `return { refetch: false }` усередині onInsert/onUpdate/onDelete
 * мусить мати write-back (collection.utils.writeUpsert/writeUpdate/
 * writeInsert/writeDelete/writeBatch) СЕРЕД STATEMENT-ів, що передують
 * цьому return у його ланцюжку блоків (усі попередні сиблінги в кожному
 * батьківському Block аж до тіла хендлера).
 *
 * 🔴 Path-sensitive рівно настільки: `if (x) return {refetch:false}` без
 * write-back вище по ланцюжку — офендер; write-back у ЧУЖІЙ гілці не
 * рахується, бо він не передує return-у в його ланцюжку. Виняток —
 * коментар `// canon-exempt: <причина>` рядком вище return.
 * BASELINE порожній і лишається порожнім: гейт постійний.
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

  const isRefetchFalse = (node: ts.Node): boolean =>
    ts.isReturnStatement(node) &&
    !!node.expression &&
    ts.isObjectLiteralExpression(node.expression) &&
    node.expression.properties.some(
      (p) =>
        ts.isPropertyAssignment(p) &&
        p.name.getText() === 'refetch' &&
        p.initializer.kind === ts.SyntaxKind.FalseKeyword,
    );

  /**
   * Opt-out `// canon-exempt: <причина>` — РІВНО рядком вище return-а
   * (R13: сирий пошук по 200 символах глушив детекцію коментарем за три
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

  /** Чи є в піддереві фактичний CallExpression collection.utils.write*(…). */
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
   * Statement — справжній write-back: або прямий write*-виклик, або
   * `writeBatch(cb)`, чий callback САМ містить write*-виклик. Порожній
   * batch — не write-back.
   */
  const isRealWrite = (st: ts.ExpressionStatement): boolean => {
    const expr = st.expression;
    if (
      !ts.isCallExpression(expr) ||
      !ts.isPropertyAccessExpression(expr.expression)
    )
      return false;
    const name = expr.expression.name.text;
    if (WRITE_OPS.has(name)) return true;
    if (name === 'writeBatch') {
      const cb = expr.arguments[0];
      return !!cb && containsWriteCall(cb);
    }
    return false;
  };

  const precededByWrite = (ret: ts.Node, boundary: ts.Node): boolean => {
    let cur: ts.Node = ret;
    while (cur !== boundary && cur.parent) {
      const parent = cur.parent;
      if (ts.isBlock(parent)) {
        for (const st of parent.statements) {
          if (st === cur) break;
          // 🔴 Зараховуємо лише БЕЗУМОВНИЙ write-statement (рев'ю р2:
          // `if (cond) writeUpsert(...)` — попередній сиблінг, але
          // write у чужій гілці; такий НЕ рахується — це IfStatement,
          // не ExpressionStatement). І лише за AST, не regex по тексту
          // (рев'ю р3): порожній `writeBatch(() => {})` чи слово в
          // коментарі/рядку — не write-back.
          if (ts.isExpressionStatement(st) && isRealWrite(st)) return true;
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

  const isRefetchFalseExpr = (e: ts.Node): boolean => {
    const inner = ts.isParenthesizedExpression(e) ? e.expression : e;
    return (
      ts.isObjectLiteralExpression(inner) &&
      inner.properties.some(
        (p) =>
          ts.isPropertyAssignment(p) &&
          p.name.getText() === 'refetch' &&
          p.initializer.kind === ts.SyntaxKind.FalseKeyword,
      )
    );
  };

  const visitHandlerBody = (body: ts.Node) => {
    // Concise-arrow `async () => ({ refetch: false })` — тіло не Block: це
    // «return <expr>» без жодного місця для write-back → офендер за
    // побудовою (окрім exempt). R13-дрібниця: явний ReturnStatement — не
    // єдина форма return-а.
    if (!ts.isBlock(body)) {
      if (isRefetchFalseExpr(body) && !hasExempt(body.parent)) report(body);
      return;
    }
    const walk = (n: ts.Node) => {
      if (isRefetchFalse(n) && !hasExempt(n) && !precededByWrite(n, body))
        report(n);
      ts.forEachChild(n, walk);
    };
    walk(body);
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
        visitHandlerBody(fn.body);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Одноразовий .ts-фікстур для юніт-тестів `offendersIn` напряму, без
 * торкання реальних колекцій (R13: раніше canon-exempt і concise-arrow не
 * мали ЖОДНОГО автоматичного кейса — лише ручні негативні контролі на
 * `collections/order-statuses.ts`).
 */
function withFixture(code: string, run: (file: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'handler-canon-'));
  const file = join(dir, 'fixture.ts');
  writeFileSync(file, code, 'utf8');
  try {
    run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('handler-canon: refetch:false ⇒ write-back у своєму ланцюжку', () => {
  it('офендерів немає (BASELINE порожній назавжди)', () => {
    const offenders = [...tsFiles(ROOT)].flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });
});

describe('canon-exempt: заякорений рядком вище, з причиною (R13)', () => {
  it('директива РІВНО рядком вище return-а — офендера немає', () => {
    withFixture(
      [
        'export const c = {',
        '  onDelete: async () => {',
        '    // canon-exempt: тестова причина',
        '    return { refetch: false };',
        '  },',
        '};',
        '',
      ].join('\n'),
      (file) => expect(offendersIn(file)).toEqual([]),
    );
  });

  it('директива за три рядки вище, і окремо — без причини: офендер в обох випадках', () => {
    // Три рядки вище (два порожні рядки між коментарем і return-ом) —
    // саме той кейс, який стара 200-символьна евристика мовчки глушила.
    withFixture(
      [
        'export const c = {',
        '  onDelete: async () => {',
        '    // canon-exempt: тестова причина',
        '',
        '',
        '    return { refetch: false };',
        '  },',
        '};',
        '',
      ].join('\n'),
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
    // Директива рівно рядком вище, але БЕЗ причини після ":" — теж не opt-out.
    withFixture(
      [
        'export const c = {',
        '  onDelete: async () => {',
        '    // canon-exempt:',
        '    return { refetch: false };',
        '  },',
        '};',
        '',
      ].join('\n'),
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
  });
});

describe('concise-arrow тіло — офендер за побудовою (R13)', () => {
  it('async () => ({ refetch: false }) без write-back — завжди офендер (write-back неможливий у виразі)', () => {
    withFixture(
      [
        'export const c = {',
        '  onUpdate: async () => ({ refetch: false }),',
        '};',
        '',
      ].join('\n'),
      (file) => expect(offendersIn(file)).toHaveLength(1),
    );
  });

  it('той самий concise-arrow з canon-exempt рядком вище — офендера немає', () => {
    // 🔴 Для concise-arrow «сам вузол» — це ArrowFunction, а не
    // PropertyAssignment: коментар над УСІМ рядком `onUpdate: async () =>`
    // прикріпився б як leading trivia до імені властивості, не до стрілки
    // (getFullStart() ArrowFunction — одразу після токена `:`). Тому
    // директива стоїть МІЖ `:` і `async`, рівно рядком вище стрілки —
    // так само, як для Block-форми вона стоїть рядком вище return-а.
    withFixture(
      [
        'export const c = {',
        '  onUpdate:',
        '    // canon-exempt: тестова причина',
        '    async () => ({ refetch: false }),',
        '};',
        '',
      ].join('\n'),
      (file) => expect(offendersIn(file)).toEqual([]),
    );
  });
});
