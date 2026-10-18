// Спільна зачистка вихідного тексту для ТЕКСТОВИХ гейтів (регекс по коду): коментар не
// має змінювати вердикт гейта — ні задовольняти обов'язкову форму виклику, ні давати
// заборонену. Одна реалізація для всіх гейтів, а не копія в кожному (Task 17б fix-2, N1).
//
// 🔴 Токени дає лексер TypeScript у контексті парсера (Task 17б fix-3), а не регекс: регекс
// не знає, де закінчується шаблонний рядок із вкладеним шаблоном у `${…}`, де починається
// регекс-літерал і що `//` у JSX-тексті — не коментар. Помилка там зрізала б код після
// «коментаря», а отже давала б хибний вердикт гейтам, що на цьому помічнику стоять.
import ts from 'typescript';

const STRING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

/** Вид скрипта за розширенням: JSX розбирається лише там, де він можливий. */
function scriptKind(fileName: string): ts.ScriptKind {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.[mc]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
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
 * Тривіа між токенами без коментарів; рядки не зливаються. Між двома токенами парсера лежать
 * ЛИШЕ пробіли й коментарі, тож сканер тут контексту не потребує (на відміну від регексу по
 * всьому файлу).
 */
function triviaWithoutComments(text: string, from: number, to: number): string {
  let out = '';
  trivia.setText(text, from, to - from);
  for (
    let k = trivia.scan();
    k !== ts.SyntaxKind.EndOfFileToken;
    k = trivia.scan()
  ) {
    const piece = trivia.getTokenText();
    if (k === ts.SyntaxKind.SingleLineCommentTrivia) continue;
    // Блоковий коментар → його переноси рядків або пробіл: сусідні токени не склеюються.
    if (k === ts.SyntaxKind.MultiLineCommentTrivia)
      out += piece.replace(/[^\n]/g, '') || ' ';
    else out += piece;
  }
  return out;
}

/** Текст літерала без вмісту: лапки, бектики й `${`/`}` шаблону лишаються. */
function emptied(token: string, kind: ts.SyntaxKind): string {
  switch (kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return token[0]! + token[0]!;
    case ts.SyntaxKind.TemplateHead:
      return '`${';
    case ts.SyntaxKind.TemplateMiddle:
      return '}${';
    default:
      return '}`';
  }
}

/**
 * Прибирає коментарі й ВМІСТ рядкових літералів (лапки лишаються): згадка імені
 * в коментарі чи назві тесту не є його визначенням. Вирази в `${…}` шаблонів — код і
 * лишаються. `keepStrings` — літерали як є (лише коментарі геть). `fileName` — лише для
 * виду скрипта (`.tsx`/`.jsx` — з JSX); за замовчуванням TypeScript без JSX.
 */
export function stripCommentsAndStrings(
  src: string,
  keepStrings = false,
  fileName = 'source.ts',
): string {
  const sf = ts.createSourceFile(
    fileName,
    src,
    ts.ScriptTarget.Latest,
    false,
    scriptKind(fileName),
  );
  let out = '';
  let cursor = 0;
  for (const token of tokens(sf)) {
    const start = token.getStart(sf);
    out += triviaWithoutComments(src, cursor, start);
    const text = src.slice(start, token.end);
    out +=
      !keepStrings && STRING_KINDS.has(token.kind)
        ? emptied(text, token.kind)
        : text;
    cursor = token.end;
  }
  return out + triviaWithoutComments(src, cursor, src.length);
}

/**
 * Лише код: коментарі прибрано, рядкові й шаблонні літерали лишено як є (SQL у
 * шаблонах, специфікатори імпортів, URL з `//`). Обгортка для гейтів, що матчать форму
 * виклику чи імпорт, а не імена.
 */
export const codeOnly = (src: string, fileName?: string): string =>
  stripCommentsAndStrings(src, true, fileName);
