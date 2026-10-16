// Що вважати текстом поля перекладу: єдиний предикат для нормалізації вводу,
// хешів, статусів і «перекладено для SEO». IO немає (T1, клієнтобезпечно).

/** Медіа без тексту: картинка чи відео в розмітці — це вміст, а не порожнеча. */
const MEDIA_TAGS: ReadonlySet<string> = new Set(['img', 'video', 'iframe']);

/**
 * «Порожні» символи: пробіли Unicode (у т.ч. nbsp, en/em/thin space — їх знає
 * `\s`) і нульової ширини (ZWSP/ZWNJ/ZWJ, word joiner, BOM). Текст лише з них
 * на екрані порожній, тож не є вмістом.
 */
const INVISIBLE_CHAR = /^[\s\u200B-\u200D\u2060\uFEFF]$/;
const INVISIBLE_RUN = /[\s\u200B-\u200D\u2060\uFEFF]+/g;
const NAMED_INVISIBLE: Readonly<Record<string, string>> = {
  nbsp: '\u00a0',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  hairsp: '\u200a',
  zwnj: '\u200c',
  zwj: '\u200d',
  nobreak: '\u2060',
};
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z0-9]+));/gi;

/** Сутність, що розкривається в «порожній» символ, зникає; решта лишається текстом. */
function dropInvisibleEntities(text: string): string {
  return text.replace(
    ENTITY,
    (whole, dec?: string, hex?: string, name?: string) => {
      const cp = dec ? Number(dec) : hex ? parseInt(hex, 16) : null;
      const ch =
        cp === null
          ? NAMED_INVISIBLE[(name ?? '').toLowerCase()]
          : cp > 0x10ffff
            ? undefined
            : String.fromCodePoint(cp);
      return ch !== undefined && INVISIBLE_CHAR.test(ch) ? '' : whole;
    },
  );
}

const isBlank = (text: string): boolean =>
  text.replace(INVISIBLE_RUN, '') === '';
const LETTER = /[A-Za-z]/;
const SPACE = /\s/;

/** Позиція після `>` тегу, що починається в `from` (`<` уже на `from`); лапки значень атрибутів не рвуть тег. */
function skipTag(html: string, from: number): number {
  let expectValue = false;
  for (let i = from + 1; i < html.length; i += 1) {
    const c = html[i]!;
    if (c === '>') return i + 1;
    if (c === '=') expectValue = true;
    else if ((c === '"' || c === "'") && expectValue) {
      const close = html.indexOf(c, i + 1);
      // Незакрита лапка: решта рядка — значення атрибута, тегу кінця немає.
      if (close < 0) return html.length;
      i = close;
      expectValue = false;
    } else if (!SPACE.test(c)) expectValue = false;
  }
  return html.length;
}

/** Ім'я тегу (нижній регістр) для `<name` чи `</name`; `null` — це не тег, а звичайний `<`. */
function tagName(html: string, at: number): string | null {
  const closing = html[at + 1] === '/';
  const start = at + (closing ? 2 : 1);
  if (!LETTER.test(html[start] ?? '')) return null;
  let end = start;
  while (end < html.length && !/[\s/>]/.test(html[end]!)) end += 1;
  return closing ? '' : html.slice(start, end).toLowerCase();
}

/**
 * Розбір розмітки на текст і медіа. Токенайзер, а не регекс: `>` усередині
 * значення атрибута (`<p title="a>b"></p>`) не завершує тег, а `<img` у
 * лапках атрибута чи екранований `&lt;img` — не медіа. Повний DOM-парсер
 * тут недоречний: модуль клієнтобезпечний (T1), `sanitize-html` серверний, а
 * `DOMParser` у Node/SSR немає.
 */
function scan(html: string): { text: string; media: boolean } {
  let text = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') {
      text += html[i];
      i += 1;
    } else if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? html.length : end + 3;
    } else if (html[i + 1] === '!' || html[i + 1] === '?') {
      i = skipTag(html, i);
    } else {
      const name = tagName(html, i);
      if (name === null) {
        text += '<';
        i += 1;
      } else if (MEDIA_TAGS.has(name)) {
        return { text, media: true };
      } else {
        i = skipTag(html, i);
      }
    }
  }
  return { text, media: false };
}

/**
 * Чи має санітизований HTML вміст. `RichTextEditor` віддає `<p></p>` для
 * очищеного редактора, а санітизатор такий рядок зберігає, тож порожній
 * rich-текст мусить розпізнаватись за розміткою: текст після зняття тегів і
 * `&nbsp;`/пробілів порожній І немає `<img`, `<video`, `<iframe`.
 */
export function hasRichText(html: string): boolean {
  const { text, media } = scan(html);
  return media || !isBlank(dropInvisibleEntities(text));
}

/**
 * Є справжній текст (не `null`, не порожній рядок, не самі пробіли). `rich` —
 * поле зі `spec.richHtml`: його порожнеча визначається розміткою, а не лише
 * пробілами. 🔴 Параметр ОБОВ'ЯЗКОВИЙ без значення за замовчуванням: пропущений
 * `rich` мовчки рахував би `<p></p>` текстом (клас дефекту Task 3), а так
 * виклик без нього не компілюється. Обирати значення тут — справа `spec`
 * (`isRichField`), а не викликача навмання.
 */
export function hasText(
  value: string | null | undefined,
  rich: boolean,
): value is string {
  if (typeof value !== 'string') return false;
  return rich ? hasRichText(value) : !isBlank(value);
}

/**
 * Нормалізація вводу поля (§3.4): `undefined` — поле не надіслано (не чіпати),
 * `null`, `''`, самі пробіли і (для rich-поля) розмітка без вмісту — очистити
 * (`null`), решта — як є. Непорожній текст не обрізається: пробіли по краях
 * можуть бути частиною rich-розмітки, а хеш і так нормалізує (`NFC` + `trim`).
 */
export function normalizeTextInput(
  value: string | null | undefined,
  rich: boolean,
): string | null | undefined {
  if (value === undefined) return undefined;
  return hasText(value, rich) ? value : null;
}
