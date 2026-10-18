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

/**
 * Вид скрипта за розширенням: JSX розбирається лише там, де він можливий. Невідоме
 * розширення — помилка, а не «мовчки TS»: без імені файла `.tsx` з `//` у JSX-тексті
 * лексер TS прочитав би як коментар і зрізав би код після нього (хибно-зелений гейт).
 */
function scriptKind(fileName: string): ts.ScriptKind | undefined {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.[mc]?ts$/.test(fileName)) return ts.ScriptKind.TS;
  if (/\.[mc]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return undefined;
}

/**
 * Лексика не-скриптових файлів, які читають текстові гейти (`doc-symbols-exist` індексує
 * SQL-функції й CSS): коментарі й рядкові літерали за правилами САМЕ цієї мови. Тіла
 * `$$…$$` у SQL — код (PL/pgSQL), а не рядок: у них визначення й виклики.
 */
const FOREIGN_LEXICON: Record<string, RegExp> = {
  sql: /('(?:[^']|'')*')|--[^\n]*|\/\*[\s\S]*?\*\//g,
  css: /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\/\*[\s\S]*?\*\//g,
};

function stripForeign(
  src: string,
  lexicon: RegExp,
  keepStrings: boolean,
): string {
  return src.replace(lexicon, (whole, literal: string | undefined) => {
    if (literal !== undefined)
      return keepStrings ? literal : literal[0]! + literal[0]!;
    // Блоковий коментар → його переноси рядків або пробіл: сусідні токени не склеюються.
    return whole.startsWith('--') ? '' : whole.replace(/[^\n]/g, '') || ' ';
  });
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
 * лишаються. `keepStrings` — літерали як є (лише коментарі геть).
 *
 * @param fileName обов'язковий: від розширення залежить лексика (`.tsx`/`.jsx` — з JSX,
 *   `.sql`, `.css` — власні правила); невідоме розширення — помилка.
 */
export function stripCommentsAndStrings(
  src: string,
  fileName: string,
  keepStrings = false,
): string {
  const kind = scriptKind(fileName);
  if (kind === undefined) {
    const lexicon = FOREIGN_LEXICON[/\.([a-z]+)$/.exec(fileName)?.[1] ?? ''];
    if (!lexicon)
      throw new Error(
        `[source-text] невідоме розширення «${fileName}»: лексика файла невизначена`,
      );
    return stripForeign(src, lexicon, keepStrings);
  }
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
 * виклику чи імпорт, а не імена. `fileName` обов'язковий — як у `stripCommentsAndStrings`.
 */
export const codeOnly = (src: string, fileName: string): string =>
  stripCommentsAndStrings(src, fileName, true);

/** Вміст між збереженими краями токена → пробіли (переноси рядків лишаються). */
const blank = (text: string, head: number, tail: number): string =>
  text.slice(0, head) +
  text.slice(head, text.length - tail).replace(/[^\n]/g, ' ') +
  text.slice(text.length - tail);

/** Скільки символів країв лишити літералу: лапки, бектики, `${` і `}` шаблону. */
function edges(kind: ts.SyntaxKind): [number, number] {
  switch (kind) {
    case ts.SyntaxKind.TemplateHead:
      return [1, 2];
    case ts.SyntaxKind.TemplateMiddle:
      return [1, 2];
    default:
      return [1, 1];
  }
}

/**
 * Те саме, що `stripCommentsAndStrings`, але ЗІ ЗБЕРЕЖЕННЯМ ЗСУВІВ: коментарі й (з `strings`)
 * вміст літералів стають пробілами тієї ж довжини, переноси рядків лишаються. Для гейтів, що
 * рахують межі функцій по маскованому тексту й вирізають шматки з немаскованого за тими
 * самими індексами (`live-smoke-no-instant-checks/scan-db-reads.ts`).
 */
export function maskKeepingOffsets(
  src: string,
  fileName: string,
  strings: boolean,
): string {
  const kind = scriptKind(fileName);
  if (kind === undefined)
    throw new Error(
      `[source-text] maskKeepingOffsets: лише скрипти, не «${fileName}»`,
    );
  const sf = ts.createSourceFile(
    fileName,
    src,
    ts.ScriptTarget.Latest,
    false,
    kind,
  );
  const triviaBlank = (from: number, to: number): string => {
    let out = '';
    trivia.setText(src, from, to - from);
    for (
      let k = trivia.scan();
      k !== ts.SyntaxKind.EndOfFileToken;
      k = trivia.scan()
    ) {
      const piece = trivia.getTokenText();
      out +=
        k === ts.SyntaxKind.SingleLineCommentTrivia ||
        k === ts.SyntaxKind.MultiLineCommentTrivia
          ? piece.replace(/[^\n]/g, ' ')
          : piece;
    }
    return out;
  };
  let out = '';
  let cursor = 0;
  for (const token of tokens(sf)) {
    const start = token.getStart(sf);
    out += triviaBlank(cursor, start);
    const text = src.slice(start, token.end);
    out +=
      strings && STRING_KINDS.has(token.kind)
        ? blank(text, ...edges(token.kind))
        : text;
    cursor = token.end;
  }
  return out + triviaBlank(cursor, src.length);
}
