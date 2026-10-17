import { scan } from './text';

const ENTITY_TEXT: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi;

/**
 * Звичайний текст із санітизованої розмітки rich-поля — для `meta description`,
 * `og:description` і JSON-LD, де теги недопустимі (спека §7.4). Теги знімає той
 * самий токенайзер, що й предикат «є вміст», тож `>` у значенні атрибута не
 * обриває тег; сутності розкриваються лише базові (решта санітизатором уже
 * нормалізована); пробіли схлопуються. Закриття блокових тегів і `<br>` дають
 * пробіл, інакше `<p>a</p><p>b</p>` склеїлось би в `ab`.
 */
export function richTextToPlain(html: string): string {
  const { text } = scan(html.replace(BLOCK_END, ' $&'), false);
  return text
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
      const named = ENTITY_TEXT[body.toLowerCase()];
      if (named !== undefined) return named;
      const cp = body.startsWith('#x')
        ? parseInt(body.slice(2), 16)
        : body.startsWith('#')
          ? Number(body.slice(1))
          : null;
      return cp !== null && cp > 0 && cp <= 0x10ffff
        ? String.fromCodePoint(cp)
        : whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
