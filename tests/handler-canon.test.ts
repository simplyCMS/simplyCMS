import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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

  const hasExempt = (node: ts.Node): boolean =>
    /canon-exempt:/.test(
      src.slice(Math.max(0, node.getFullStart() - 200), node.getStart()),
    );

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

  const visitHandlerBody = (body: ts.Node) => {
    const walk = (n: ts.Node) => {
      if (isRefetchFalse(n) && !hasExempt(n) && !precededByWrite(n, body))
        out.push(
          `${relative(process.cwd(), file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
        );
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

describe('handler-canon: refetch:false ⇒ write-back у своєму ланцюжку', () => {
  it('офендерів немає (BASELINE порожній назавжди)', () => {
    const offenders = [...tsFiles(ROOT)].flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });
});
