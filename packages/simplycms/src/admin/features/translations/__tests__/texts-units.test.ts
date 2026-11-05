import { describe, expect, it } from 'vitest';
import { textsDiff } from '../texts-diff';
import { textsErrorField, textsErrorLocale } from '../texts-errors';
import { localeStatusesOf, textsToForm } from '../texts-form';
import { rebaseTexts } from '../texts-rebase';

const PRODUCT = [
  'name',
  'shortDescription',
  'description',
  'metaTitle',
  'metaDescription',
] as const;
const SINGLE = ['name'] as const;

const row = (o: Partial<Record<(typeof PRODUCT)[number], string>> = {}) => ({
  name: '',
  shortDescription: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  ...o,
});

describe.each([
  ['товар', PRODUCT, row({ name: 'A' }), row({ name: 'A', metaTitle: 'T' })],
  ['однопольний', SINGLE, { name: 'A' }, { name: 'A' }],
] as const)('набір полів: %s', (_n, fields, base, same) => {
  type R = Record<string, string>;
  const f = fields as readonly string[];

  it('diff не надсилає незмінене поле й незмінену мову', () => {
    const before = { uk: base as R, en: base as R };
    const after = { uk: base as R, en: { ...(base as R), name: 'B' } };
    expect(textsDiff(f, before, after)).toEqual({ en: { name: 'B' } });
    expect(textsDiff(f, before, { uk: same as R, en: base as R })).toEqual(
      fields.length > 1 ? { uk: { metaTitle: 'T' } } : {},
    );
  });

  it('diff очищення поля = null', () => {
    const after = { uk: { ...(base as R), name: '' } };
    expect(textsDiff(f, { uk: base as R }, after)).toEqual({
      uk: { name: null },
    });
  });

  it('rebase не затирає локальну правку, решту бере БД', () => {
    const sent = { uk: { ...(base as R), name: 'S' } };
    const now = { uk: { ...(base as R), name: 'Мій' } };
    const fresh = { uk: { ...(base as R), name: 'З БД' } };
    expect(rebaseTexts(f, fresh, sent, now).uk!.name).toBe('Мій');
    expect(rebaseTexts(f, fresh, sent, sent).uk!.name).toBe('З БД');
  });

  it('textsToForm: null і відсутня мова стають порожніми рядками', () => {
    const out = textsToForm(f, { uk: { name: null } }, ['uk', 'en']);
    expect(Object.keys(out).sort()).toEqual(['en', 'uk']);
    expect(out.en).toEqual(Object.fromEntries(f.map((k) => [k, ''])));
  });
});

describe('textsErrorField', () => {
  it('texts.<мова>.<поле> → поле форми і вкладка', () => {
    expect(textsErrorField(['texts', 'en', 'name'])).toBe('texts.en.name');
    expect(textsErrorLocale('texts.en.name')).toBe('en');
  });
  it('інші шляхи — не текст', () => {
    expect(textsErrorField(['path'])).toBeNull();
    expect(textsErrorField(['texts', 'en'])).toBeNull();
    expect(textsErrorLocale('path')).toBeNull();
  });
});

describe('localeStatusesOf', () => {
  it('переносить статус рядка й полів', () => {
    expect(
      localeStatusesOf({
        en: { status: 'outdated', fieldStatus: { name: 'current' } },
      }),
    ).toEqual({
      en: { status: 'outdated', fieldStatus: { name: 'current' } },
    });
  });
});
