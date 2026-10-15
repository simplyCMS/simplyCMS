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
    expect(normalizeTextInput('<p></p>')).toBe('<p></p>');
  });

  it('fieldStatus: порожній rich-переклад — missing, звичайне поле з тим самим рядком — ні', () => {
    expect(fieldStatus('<p></p>', undefined, null, true)).toBe('missing');
    expect(fieldStatus('<p></p>', undefined, null)).toBe('current');
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
