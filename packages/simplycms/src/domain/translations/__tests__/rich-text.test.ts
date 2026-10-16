import { describe, expect, it } from 'vitest';
import {
  fieldStatus,
  hasRichText,
  isTranslatedForSeo,
  normalizeTextInput,
  planTranslationWrite,
  rowStatus,
  toSourceRow,
  type SourceRow,
  type TranslatableSpec,
} from '../index';

// Порожній rich-текст: `RichTextEditor` віддає `<p></p>` для очищеного
// редактора, і санітизатор такий рядок зберігає.
const SPEC: TranslatableSpec = {
  fields: ['name', 'description'],
  required: ['name'],
  richHtml: ['description'],
};
const hash = (text: string) => `h(${text})`;

const EMPTY_RICH = ['<p></p>', '<p> </p>', '<p>&nbsp;</p>', '<p><br></p>'];
const FILLED_RICH = [
  '<p>Текст</p>',
  '<p><img src="x"></p>',
  '<video src="x"></video>',
  '<iframe src="x"></iframe>',
  '<p>&amp;</p>',
];

describe('порожній rich-text не є текстом (спільний предикат)', () => {
  it.each(EMPTY_RICH)('hasRichText(%j) = false', (html) => {
    expect(hasRichText(html)).toBe(false);
  });

  it.each(FILLED_RICH)('hasRichText(%j) = true', (html) => {
    expect(hasRichText(html)).toBe(true);
  });

  it.each(EMPTY_RICH)('normalizeTextInput(%j, rich) → null', (html) => {
    expect(normalizeTextInput(html, true)).toBeNull();
  });

  it.each(FILLED_RICH)('normalizeTextInput(%j, rich) лишає текст', (html) => {
    expect(normalizeTextInput(html, true)).toBe(html);
  });

  it('для не-rich поля розмітка — звичайний текст', () => {
    expect(normalizeTextInput('<p></p>', false)).toBe('<p></p>');
  });

  it('fieldStatus: порожній rich-переклад — missing, звичайне поле з тим самим рядком — ні', () => {
    expect(fieldStatus('<p></p>', undefined, null, true)).toBe('missing');
    expect(fieldStatus('<p></p>', undefined, null, false)).toBe('current');
  });

  it('toSourceRow: порожній rich не має хеша', () => {
    const source = toSourceRow(
      SPEC,
      { name: 'Назва', description: '<p></p>' },
      hash,
    );
    expect(source.currentHashes).toEqual({ name: 'h(Назва)' });
  });

  it('rowStatus: обов’язкове rich-поле з <p></p> → missing', () => {
    const spec: TranslatableSpec = {
      ...SPEC,
      required: ['name', 'description'],
    };
    const source: SourceRow = { values: {}, currentHashes: {} };
    expect(
      rowStatus(spec, source, {
        values: { name: 'N', description: '<p></p>' },
      }),
    ).toBe('missing');
  });
});

describe('hasRichText не обманюється атрибутами й екрануванням', () => {
  it.each([
    // `>` у значенні атрибута не завершує тег: решта тегу — не текст.
    '<p title="a>b"></p>',
    "<p title='a>b'></p>",
    '<p data-x="a > b" class="c"><br></p>',
    // `<img` у лапках атрибута — не медіа.
    '<p title="<img src=x>"></p>',
    '<!-- <img> --><p></p>',
  ])('порожньо: %j', (html) => {
    expect(hasRichText(html)).toBe(false);
  });

  it.each([
    // Екранований `<img` — це видимий текст.
    '<p>&lt;img&gt;</p>',
    '<p>&lt;img</p>',
    '<p title="a>b">текст</p>',
    '<IMG SRC="x">',
    '<img/>',
    // Знак «менше» без імені тегу — текст.
    '<p>1 < 2</p>',
  ])('не порожньо: %j', (html) => {
    expect(hasRichText(html)).toBe(true);
  });

  it.each([
    '<p>&#00160;</p>',
    '<p>&ensp;&emsp;&thinsp;</p>',
    '<p>&#x2003;&#8201;</p>',
    '<p>\u200B\u200C\u200D\u2060\uFEFF</p>',
    '<p>&#8203;&zwnj;</p>',
  ])('невидимі символи й сутності — не вміст: %j', (html) => {
    expect(hasRichText(html)).toBe(false);
    expect(normalizeTextInput(html, true)).toBeNull();
  });

  it('звичайне (не rich) поле: символи нульової ширини — теж порожнеча, сутності — ні', () => {
    expect(normalizeTextInput('\u200B\uFEFF \u2060', false)).toBeNull();
    expect(normalizeTextInput('&nbsp;', false)).toBe('&nbsp;');
  });

  it('сутність, що не є пробілом, — текст', () => {
    expect(hasRichText('<p>&amp;</p>')).toBe(true);
    expect(hasRichText('<p>&#65;</p>')).toBe(true);
  });

  it('незавершений тег не дає тексту і не кидає', () => {
    expect(hasRichText('<p title="abc')).toBe(false);
    expect(hasRichText('<p')).toBe(false);
  });
});

describe('isTranslatedForSeo з rich-текстом (І33)', () => {
  it('джерело з порожнім rich-описом перекладу не вимагає', () => {
    const source = { values: { name: 'Назва', description: '<p></p>' } };
    expect(isTranslatedForSeo(SPEC, source, { values: { name: 'Name' } })).toBe(
      true,
    );
  });

  it('переклад <p></p> при непорожньому джерелі не рахується перекладеним', () => {
    const source = { values: { name: 'Назва', description: '<p>Опис</p>' } };
    const target = { values: { name: 'Name', description: '<p></p>' } };
    expect(isTranslatedForSeo(SPEC, source, target)).toBe(false);
  });
});

describe('planTranslationWrite з rich-текстом', () => {
  const plan = (description: string, sourceDescription: string | null) =>
    planTranslationWrite({
      spec: SPEC,
      current: {
        source: { values: { name: 'Назва', description: sourceDescription } },
        byLocale: new Map(),
      },
      primary: 'uk',
      patch: new Map([['en', { name: 'Name', description }]]),
      hash,
    }).upserts[0];

  it('<p></p> у патчі очищує поле (null) і хеша не лишає', () => {
    const upsert = plan('<p></p>', '<p>Опис</p>');
    expect(upsert?.values).toEqual({ name: 'Name', description: null });
    expect(upsert?.sourceHashes).toEqual({ name: 'h(Назва)' });
  });

  it('джерело з <p></p>: хеша для поля немає (порожнє джерело)', () => {
    const upsert = plan('<p>Description</p>', '<p></p>');
    expect(upsert?.sourceHashes).toEqual({ name: 'h(Назва)' });
  });

  it('непорожнє rich-поле хешується від розмітки джерела', () => {
    const upsert = plan('<p>Description</p>', '<p>Опис</p>');
    expect(upsert?.sourceHashes).toEqual({
      name: 'h(Назва)',
      description: 'h(<p>Опис</p>)',
    });
  });
});
