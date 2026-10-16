import { describe, expect, it } from 'vitest';
import {
  fieldStatus,
  isTranslatedForSeo,
  normalizeTextInput,
  rowStatus,
  toSourceRow,
  type SourceRow,
  type TranslatableSpec,
  type TranslationRow,
} from '../index';

const SPEC: TranslatableSpec = {
  fields: ['name', 'short_description', 'description', 'meta_description'],
  required: ['name'],
  richHtml: ['description'],
};

const row = (
  values: TranslationRow['values'],
  hashes: Record<string, string> = {},
): TranslationRow => ({ values, hashes });

describe('normalizeTextInput (§3.4: порожнє = null, відсутнє = undefined)', () => {
  it('undefined лишається undefined — поле не надіслано', () => {
    expect(normalizeTextInput(undefined, false)).toBeUndefined();
  });

  it('null лишається null — явне очищення', () => {
    expect(normalizeTextInput(null, false)).toBeNull();
  });

  it.each(['', ' ', '   \n\t '])('%j → null', (value) => {
    expect(normalizeTextInput(value, false)).toBeNull();
  });

  it('непорожній текст не чіпається (пробіли по краях — частина тексту)', () => {
    expect(normalizeTextInput(' Назва ', false)).toBe(' Назва ');
  });
});

describe('fieldStatus', () => {
  it('немає тексту → missing, навіть коли хеш збігається', () => {
    expect(fieldStatus(null, undefined, 'x', false)).toBe('missing');
    expect(fieldStatus(null, 'x', 'x', false)).toBe('missing');
    expect(fieldStatus('   ', 'x', 'x', false)).toBe('missing');
  });

  it('хеш збігається → current', () => {
    expect(fieldStatus('y', 'h1', 'h1', false)).toBe('current');
  });

  it('хеш розійшовся → outdated', () => {
    expect(fieldStatus('y', 'h0', 'h1', false)).toBe('outdated');
  });

  it('хеша немає, а у джерела текст є → outdated (походження невідоме)', () => {
    expect(fieldStatus('y', undefined, 'h1', false)).toBe('outdated');
  });

  it('джерело порожнє: переклад без хеша — current, із хешем (колишнього тексту) — outdated', () => {
    expect(fieldStatus('y', undefined, null, false)).toBe('current');
    expect(fieldStatus('y', 'h1', null, false)).toBe('outdated');
  });
});

describe('rowStatus', () => {
  const source: SourceRow = {
    values: { name: 'Назва', description: 'Опис' },
    currentHashes: { name: 'h(Назва)', description: 'h(Опис)' },
  };

  it('рядка перекладу немає → missing', () => {
    expect(rowStatus(SPEC, source, null)).toBe('missing');
  });

  it('порожнє обов’язкове поле → missing, навіть коли решта актуальна', () => {
    const target = row(
      { name: null, description: 'Desc' },
      { description: 'h(Опис)' },
    );
    expect(rowStatus(SPEC, source, target)).toBe('missing');
  });

  it('є застаріле поле → outdated', () => {
    const target = row(
      { name: 'Name', description: 'Desc' },
      { name: 'h(Назва)', description: 'h(СтарийОпис)' },
    );
    expect(rowStatus(SPEC, source, target)).toBe('outdated');
  });

  it('усі заповнені поля актуальні → current', () => {
    const target = row(
      { name: 'Name', description: 'Desc' },
      { name: 'h(Назва)', description: 'h(Опис)' },
    );
    expect(rowStatus(SPEC, source, target)).toBe('current');
  });

  it('порожнє необов’язкове поле статус рядка не псує (його ловить isTranslatedForSeo)', () => {
    const target = row({ name: 'Name' }, { name: 'h(Назва)' });
    expect(rowStatus(SPEC, source, target)).toBe('current');
  });
});

describe('SourceRow (рядок основної мови з БД не годиться як джерело статусів)', () => {
  const hash = (text: string) => `h(${text})`;

  it('toSourceRow рахує хеші поточного тексту, поле без тексту хеша не має', () => {
    const source = toSourceRow(
      SPEC,
      { name: 'Назва', description: 'Опис', short_description: null },
      hash,
    );
    expect(source.currentHashes).toEqual({
      name: 'h(Назва)',
      description: 'h(Опис)',
    });
  });

  it('рядок з БД (source_hashes = {}) не передається в rowStatus: помилка типу', () => {
    const dbRow: TranslationRow = {
      values: { name: 'Назва' },
      hashes: {},
    };
    // @ts-expect-error — TranslationRow не SourceRow: немає currentHashes
    expect(rowStatus(SPEC, dbRow, null)).toBe('missing');
  });
});

describe('isTranslatedForSeo (§3.4: кожне непорожнє в джерелі поле непорожнє в мові)', () => {
  const source = row({
    name: 'Назва',
    description: 'Опис',
    short_description: null,
  });

  it('у джерелі є description, а в мові немає → false (змішана мова не індексується)', () => {
    const target = row({ name: 'Name', description: null });
    expect(isTranslatedForSeo(SPEC, source, target)).toBe(false);
  });

  it('поле лише outdated, але непорожнє → true', () => {
    const target = row(
      { name: 'Name', description: 'Desc' },
      { name: 'h(Стара)', description: 'h(Стара)' },
    );
    expect(isTranslatedForSeo(SPEC, source, target)).toBe(true);
  });

  it('поле, порожнє в джерелі, перекладу не вимагає', () => {
    const target = row({ name: 'Name', description: 'Desc' });
    expect(isTranslatedForSeo(SPEC, source, target)).toBe(true);
  });

  it('рядка перекладу немає → false', () => {
    expect(isTranslatedForSeo(SPEC, source, null)).toBe(false);
  });

  it('рядок із самих пробілів не рахується перекладом', () => {
    const target = row({ name: 'Name', description: '   ' });
    expect(isTranslatedForSeo(SPEC, source, target)).toBe(false);
  });
});
