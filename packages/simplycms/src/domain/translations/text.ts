// Що вважати текстом поля перекладу: єдиний предикат для нормалізації вводу,
// хешів, статусів і «перекладено для SEO». IO немає (T1, клієнтобезпечно).

/** Медіа без тексту: картинка чи відео в розмітці — це вміст, а не порожнеча. */
const MEDIA_TAGS: ReadonlySet<string> = new Set(['img', 'video', 'iframe']);
const SPACE_ENTITY = /&(?:nbsp|#160|#xa0);/gi;
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
  return media || text.replace(SPACE_ENTITY, ' ').trim() !== '';
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
  return rich ? hasRichText(value) : value.trim() !== '';
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
