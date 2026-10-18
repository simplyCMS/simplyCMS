// Спільна зачистка вихідного тексту для ТЕКСТОВИХ гейтів (регекс по коду): коментар не
// має змінювати вердикт гейта — ні задовольняти обов'язкову форму виклику, ні давати
// заборонену. Одна реалізація для всіх гейтів, а не копія в кожному (Task 17б fix-2, N1).
//
// 🔴 Токени дає лексер TypeScript у контексті парсера (Task 17б fix-3), а не регекс: регекс
// не знає, де закінчується шаблонний рядок із вкладеним шаблоном у `${…}`, де починається
// регекс-літерал і що `//` у JSX-тексті — не коментар. Помилка там зрізала б код після
// «коментаря», а отже давала б хибний вердикт гейтам, що на цьому помічнику стоять.
import ts from 'typescript';
import { rewriteScript, scriptKind } from './source-lexer';

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

/** Коментар геть: рядковий — порожньо, блоковий — його переноси або пробіл (без злипання). */
const dropComment = (piece: string, kind: ts.SyntaxKind): string =>
  kind === ts.SyntaxKind.SingleLineCommentTrivia
    ? ''
    : piece.replace(/[^\n]/g, '') || ' ';

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
  return rewriteScript(src, fileName, kind, {
    comment: dropComment,
    literal: keepStrings ? null : emptied,
  });
}

/**
 * Лише код: коментарі прибрано, рядкові й шаблонні літерали лишено як є (SQL у
 * шаблонах, специфікатори імпортів, URL з `//`). Обгортка для гейтів, що матчать форму
 * виклику чи імпорт, а не імена. `fileName` обов'язковий — як у `stripCommentsAndStrings`.
 */
export const codeOnly = (src: string, fileName: string): string =>
  stripCommentsAndStrings(src, fileName, true);

/** Усе, крім переносів рядків, — пробілами тієї ж довжини. */
const spaces = (text: string): string => text.replace(/[^\n]/g, ' ');

/** Вміст літерала → пробіли; краї (лапки, бектики, `${`, `}`) лишаються. */
function blankLiteral(text: string, kind: ts.SyntaxKind): string {
  const tail =
    kind === ts.SyntaxKind.TemplateHead || kind === ts.SyntaxKind.TemplateMiddle
      ? 2
      : 1;
  return (
    text.slice(0, 1) +
    spaces(text.slice(1, text.length - tail)) +
    text.slice(text.length - tail)
  );
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
  return rewriteScript(src, fileName, kind, {
    comment: spaces,
    literal: strings ? blankLiteral : null,
  });
}
