import { describe, expect, it } from 'vitest';
import {
  planTranslationWrite,
  type TranslatableSpec,
  type TranslationRow,
} from '../index';

const SPEC: TranslatableSpec = {
  fields: ['name', 'description', 'meta_description'],
  required: ['name'],
  richHtml: ['description'],
};

// Детермінований фейк: справжній sha256 живе в server-only `simplycms/translations`.
const hash = (text: string): string => `h(${text.normalize('NFC').trim()})`;

const row = (
  values: TranslationRow['values'],
  hashes: Record<string, string> = {},
): TranslationRow => ({ values, hashes });

const SOURCE = row({ name: 'Назва', description: 'Опис' });

/** Переклад, зроблений проти СТАРОГО опису: його хеш не збігається з поточним. */
const EN_STALE = row(
  { name: 'Name', description: 'Old description' },
  { name: 'h(Назва)', description: 'h(СтарийОпис)' },
);

const plan = (over: Partial<Parameters<typeof planTranslationWrite>[0]>) =>
  planTranslationWrite({
    spec: SPEC,
    current: { source: SOURCE, byLocale: new Map([['en', EN_STALE]]) },
    primary: 'uk',
    patch: new Map(),
    hash,
    ...over,
  });

const issuesOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    const e = error as { name: string; issues: unknown };
    return e;
  }
  throw new Error('очікувалась помилка валідації');
};

describe('planTranslationWrite', () => {
  it('сценарій 1: лише джерело — інших мов у upserts немає', () => {
    const result = plan({
      patch: new Map([['uk', { name: 'Нова назва' }]]),
    });
    expect(result.upserts).toEqual([
      { locale: 'uk', values: { name: 'Нова назва' }, sourceHashes: {} },
    ]);
    expect(result.sourceChanged).toBeNull();
  });

  it('сценарій 2: надіслане поле перекладу отримує хеш НОВОГО джерела, ненадіслане зберігає старий', () => {
    const result = plan({
      patch: new Map([
        ['uk', { name: 'Нова назва' }],
        ['en', { name: 'New name' }],
      ]),
    });
    const en = result.upserts.find((u) => u.locale === 'en');
    expect(en?.values).toEqual({ name: 'New name' });
    // name — хеш нового джерела; description не надсилали — хеш лишився СТАРИМ
    // (а не h(Опис), яким був би, якби план перерахував усе).
    expect(en?.sourceHashes).toEqual({
      name: 'h(Нова назва)',
      description: 'h(СтарийОпис)',
    });
  });

  it('сценарій 3: розбіжний expected → sourceChanged з поточними хешами, upserts порожні', () => {
    const result = plan({
      patch: new Map([
        ['uk', { description: 'Інший опис' }],
        ['en', { name: 'New name' }],
      ]),
      expectedSourceHashes: new Map([['en', { name: 'h(ЩеСтаріша)' }]]),
    });
    expect(result.upserts).toEqual([]);
    expect(result.sourceChanged).toEqual({
      locale: 'en',
      current: { name: 'h(Назва)', description: 'h(Опис)' },
    });
  });

  it('сценарій 3: збіжний expected записується, хеш = expected', () => {
    const result = plan({
      patch: new Map([['en', { name: 'New name' }]]),
      expectedSourceHashes: new Map([['en', { name: 'h(Назва)' }]]),
    });
    expect(result.sourceChanged).toBeNull();
    expect(result.upserts).toEqual([
      {
        locale: 'en',
        values: { name: 'New name' },
        sourceHashes: { name: 'h(Назва)', description: 'h(СтарийОпис)' },
      },
    ]);
  });

  it('сценарій 3: поле, назване в expected, але не надіслане, зберігає старий хеш', () => {
    // description названо й збігається з поточним джерелом, але його не
    // надсилали: актуальним стає лише надіслане поле (як у сценарії 2).
    const result = plan({
      patch: new Map([['en', { name: 'New name' }]]),
      expectedSourceHashes: new Map([
        ['en', { name: 'h(Назва)', description: 'h(Опис)' }],
      ]),
    });
    expect(result.sourceChanged).toBeNull();
    expect(result.upserts[0]?.sourceHashes).toEqual({
      name: 'h(Назва)',
      description: 'h(СтарийОпис)',
    });
  });

  it('expected називає поле, якого немає у spec → помилка валідації, а не мовчазний 409', () => {
    const error = issuesOf(() =>
      plan({
        patch: new Map([['en', { name: 'New name' }]]),
        expectedSourceHashes: new Map([['en', { slug: 'x' }]]),
      }),
    );
    expect(error.name).toBe('ValidationError');
  });

  it("null очищує необов'язкове, для обов'язкового — ValidationError", () => {
    const cleared = plan({
      patch: new Map([['en', { description: null }]]),
    });
    expect(cleared.upserts[0]?.values).toEqual({ description: null });
    // Очищене поле не має хеша: тексту, який можна було б порівняти, немає.
    expect(cleared.upserts[0]?.sourceHashes).toEqual({ name: 'h(Назва)' });

    const error = issuesOf(() =>
      plan({ patch: new Map([['en', { name: null }]]) }),
    );
    expect(error.name).toBe('ValidationError');
    expect(error.issues).toEqual([
      expect.objectContaining({ path: ['en', 'name'], code: 'too_small' }),
    ]);
  });

  it("'' і пробіли нормалізуються до null — для обов'язкового це теж ValidationError", () => {
    const blankOptional = plan({
      patch: new Map([['en', { meta_description: '   ' }]]),
    });
    expect(blankOptional.upserts[0]?.values).toEqual({
      meta_description: null,
    });

    expect(() => plan({ patch: new Map([['en', { name: '' }]]) })).toThrow();
  });

  it('відсутнє поле не змінюється', () => {
    const result = plan({
      patch: new Map([['en', { name: 'New name' }]]),
    });
    const values = result.upserts[0]?.values ?? {};
    expect(Object.keys(values)).toEqual(['name']);
    expect('description' in values).toBe(false);
  });

  it('undefined у значенні = поле не надіслано', () => {
    const result = plan({
      patch: new Map([['en', { name: 'New name', description: undefined }]]),
    });
    expect(Object.keys(result.upserts[0]?.values ?? {})).toEqual(['name']);
  });

  it("мова поза patch не з'являється в upserts", () => {
    const de = row({ name: 'Name' }, { name: 'h(Назва)' });
    const result = plan({
      current: {
        source: SOURCE,
        byLocale: new Map([
          ['en', EN_STALE],
          ['de', de],
        ]),
      },
      patch: new Map([['en', { name: 'New name' }]]),
    });
    expect(result.upserts.map((u) => u.locale)).toEqual(['en']);
  });

  it('мова з порожнім patch не породжує upsert', () => {
    const result = plan({ patch: new Map([['en', {}]]) });
    expect(result.upserts).toEqual([]);
  });

  it('ключі sourceHashes ⊆ spec.fields (І10): сміття в наявних хешах відсікається', () => {
    const polluted = row(
      { name: 'Name' },
      { name: 'h(Назва)', slug: 'h(slug)', junk: 'x' },
    );
    const result = plan({
      current: { source: SOURCE, byLocale: new Map([['en', polluted]]) },
      patch: new Map([['en', { name: 'New name' }]]),
    });
    const keys = Object.keys(result.upserts[0]?.sourceHashes ?? {});
    expect(keys.every((k) => SPEC.fields.includes(k))).toBe(true);
    expect(keys).not.toContain('slug');
  });

  it('поле поза spec у patch → помилка валідації (unrecognized_keys)', () => {
    const error = issuesOf(() =>
      plan({ patch: new Map([['en', { slug: 'x' }]]) }),
    );
    expect(error.issues).toEqual([
      expect.objectContaining({
        path: ['en', 'slug'],
        code: 'unrecognized_keys',
      }),
    ]);
  });

  it('нова сутність: джерело без обов’язкового поля → ValidationError', () => {
    expect(() =>
      plan({
        current: { source: null, byLocale: new Map() },
        patch: new Map([['uk', { description: 'Лише опис' }]]),
      }),
    ).toThrow();

    const created = plan({
      current: { source: null, byLocale: new Map() },
      patch: new Map([['uk', { name: 'Нова' }]]),
    });
    expect(created.upserts).toHaveLength(1);
  });

  it('поле, порожнє в джерелі: хеш не пишеться (порожнє джерело — current без хеша)', () => {
    const result = plan({
      current: {
        source: row({ name: 'Назва' }),
        byLocale: new Map(),
      },
      patch: new Map([['en', { name: 'Name', meta_description: 'Meta' }]]),
    });
    expect(result.upserts[0]?.sourceHashes).toEqual({ name: 'h(Назва)' });
  });
});
