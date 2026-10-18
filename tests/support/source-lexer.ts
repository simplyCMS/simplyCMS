// Лексер TS для текстових гейтів (спільний для `source-text.ts`): токени — від парсера
// TypeScript, тривіа між ними — від сканера. Тут лише обхід файла; ЩО робити з коментарями й
// літералами, вирішує викликач (зачистка, маскування зі збереженням зсувів).
//
// 🔴 Токени дає парсер, а не регекс (Task 17б fix-3): регекс не знає, де закінчується шаблонний
// рядок із вкладеним шаблоном у `${…}`, де починається регекс-літерал і що `//` у JSX-тексті —
// не коментар.
import ts from 'typescript';

/** Види рядкових і шаблонних літералів (їх вміст — не код). */
export const STRING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

/**
 * Вид скрипта за розширенням: JSX розбирається лише там, де він можливий. `undefined` —
 * не скрипт: без імені файла `.tsx` з `//` у JSX-тексті лексер TS прочитав би як коментар і
 * зрізав би код після нього (хибно-зелений гейт), тож вгадувати не можна.
 */
export function scriptKind(fileName: string): ts.ScriptKind | undefined {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.[mc]?ts$/.test(fileName)) return ts.ScriptKind.TS;
  if (/\.[mc]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return undefined;
}

/** Листові токени файла по порядку (JSDoc-вузли — це коментарі, їх пропускаємо). */
function tokens(sf: ts.SourceFile): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJSDoc(node) || node.kind === ts.SyntaxKind.JSDocComment) return;
    const children = node.getChildren(sf);
    if (children.length === 0) out.push(node);
    else for (const child of children) visit(child);
  };
  visit(sf);
  return out;
}

const trivia = ts.createScanner(ts.ScriptTarget.Latest, false);

/**
 * Тривіа між токенами з заміною КОМЕНТАРІВ через `comment`; решта (пробіли, переноси) — як є.
 * Між двома токенами парсера лежать ЛИШЕ пробіли й коментарі, тож сканер тут контексту не
 * потребує (на відміну від регексу по всьому файлу).
 */
function triviaWith(
  text: string,
  from: number,
  to: number,
  comment: (piece: string, kind: ts.SyntaxKind) => string,
): string {
  let out = '';
  trivia.setText(text, from, to - from);
  for (
    let k = trivia.scan();
    k !== ts.SyntaxKind.EndOfFileToken;
    k = trivia.scan()
  ) {
    const piece = trivia.getTokenText();
    out +=
      k === ts.SyntaxKind.SingleLineCommentTrivia ||
      k === ts.SyntaxKind.MultiLineCommentTrivia
        ? comment(piece, k)
        : piece;
  }
  return out;
}

/** Як переписати файл: коментар і токен-літерал (інші токени лишаються як є). */
export interface Rewrite {
  readonly comment: (piece: string, kind: ts.SyntaxKind) => string;
  /** `null` — літерал як є. */
  readonly literal: ((text: string, kind: ts.SyntaxKind) => string) | null;
}

/** Обхід скрипта (`kind` — з `scriptKind`) з переписуванням коментарів і літералів. */
export function rewriteScript(
  src: string,
  fileName: string,
  kind: ts.ScriptKind,
  how: Rewrite,
): string {
  const sf = ts.createSourceFile(
    fileName,
    src,
    ts.ScriptTarget.Latest,
    false,
    kind,
  );
  let out = '';
  let cursor = 0;
  for (const token of tokens(sf)) {
    const start = token.getStart(sf);
    out += triviaWith(src, cursor, start, how.comment);
    const text = src.slice(start, token.end);
    out +=
      how.literal && STRING_KINDS.has(token.kind)
        ? how.literal(text, token.kind)
        : text;
    cursor = token.end;
  }
  return out + triviaWith(src, cursor, src.length, how.comment);
}
