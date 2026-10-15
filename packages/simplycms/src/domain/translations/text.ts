// Що вважати текстом поля перекладу: єдиний предикат для нормалізації вводу,
// хешів, статусів і «перекладено для SEO». IO немає (T1, клієнтобезпечно).

/** Медіа без тексту: картинка чи відео в розмітці — це вміст, а не порожнеча. */
const MEDIA_TAG = /<\s*(?:img|video|iframe)\b/i;
const ANY_TAG = /<[^>]*>/g;
const SPACE_ENTITY = /&(?:nbsp|#160|#xa0);/gi;

/**
 * Чи має санітизований HTML вміст. `RichTextEditor` віддає `<p></p>` для
 * очищеного редактора, а санітизатор такий рядок зберігає, тож порожній
 * rich-текст мусить розпізнаватись за розміткою: текст після зняття тегів і
 * `&nbsp;`/пробілів порожній І немає `<img`, `<video`, `<iframe`.
 */
export function hasRichText(html: string): boolean {
  if (MEDIA_TAG.test(html)) return true;
  return html.replace(ANY_TAG, '').replace(SPACE_ENTITY, ' ').trim() !== '';
}

/**
 * Є справжній текст (не `null`, не порожній рядок, не самі пробіли). `rich` —
 * поле зі `spec.richHtml`: його порожнеча визначається розміткою, а не лише
 * пробілами.
 */
export function hasText(
  value: string | null | undefined,
  rich = false,
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
  rich = false,
): string | null | undefined {
  if (value === undefined) return undefined;
  return hasText(value, rich) ? value : null;
}
