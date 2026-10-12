/**
 * Чорний список брудної розмітки демо-сіду: що санітайзер НЕ має отримувати від продуктових даних.
 * Чиста функція — тест перевіряє її синтетичними рядками, а не лише реальними SQL.
 */

const NAMED: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  lpar: '(',
  rpar: ')',
};

/**
 * Декодує HTML-entities, якими обходять підрядкові чорні списки: числові (`&#106;`, `&#x6a;`,
 * зокрема без `;` — браузер прощає) і кілька іменованих (`&colon;`, `&Tab;`, `&NewLine;`).
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) =>
      String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)),
    )
    .replace(/&#(\d+);?/g, (_m, dec: string) =>
      String.fromCodePoint(Math.min(parseInt(dec, 10), 0x10ffff)),
    )
    .replace(
      /&([a-z]+);/gi,
      (m, name: string) => NAMED[name.toLowerCase()] ?? m,
    );
}

const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['<script', /<script/i],
  ['<iframe', /<iframe/i],
  ['<object', /<object/i],
  ['<embed', /<embed/i],
  ['on*=-обробник', /\bon[a-z]+\s*=/i],
  ['srcdoc', /srcdoc/i],
];

/** Назви порушених правил; порожньо — рядок чистий. */
export function dirtyMarkup(raw: string): string[] {
  // Entities декодуються ДО перевірки, а пробіли/керівні символи в схемі прибираються:
  // `java&#9;script:` і `&#106;avascript:` браузер читає як `javascript:`.
  const decoded = decodeEntities(raw);
  const hits = PATTERNS.filter(([, re]) => re.test(decoded)).map(
    ([name]) => name,
  );
  if (/javascript:/i.test(decoded.replace(/[\s\u0000-\u001f]+/g, '')))
    hits.push('javascript:');
  return hits;
}
