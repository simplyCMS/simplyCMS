/**
 * Різниця форма ↔ знімок → вхід `saveDescription`: лише змінене. Це І11 з боку
 * UI (незмінена вкладка не потрапляє в `texts`) і гарантія, що модифікації,
 * значення й фото йдуть тим самим запитом.
 */
import { describe, expect, it } from 'vitest';
import { blankForm, rebase, withStockStatus } from '../product-aggregate';
import type { ProductFormValues } from '../product-form-schema';
import {
  buildCreateInput,
  buildSaveInput,
  isEmptyInput,
  same,
} from '../product-save-input';

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const V1 = '44444444-4444-4444-8444-444444444444';
const I1 = '55555555-5555-4555-8555-555555555555';

const was = (): ProductFormValues => {
  const f = blankForm(['uk', 'en']);
  f.texts.uk!.name = 'Кабель';
  f.texts.en!.name = 'Cable';
  return f;
};
const mod = (id: string, extra: object = {}) => ({
  id,
  sku: '',
  isDefault: false,
  sortOrder: 0,
  stockStatus: 'in_stock' as 'in_stock' | 'out_of_stock' | 'on_order',
  texts: { uk: 'М', en: '' },
  token: {},
  ...extra,
});

describe('buildSaveInput', () => {
  it('нічого не змінено — порожній вхід', () => {
    const { input } = buildSaveInput(was(), was());
    expect(isEmptyInput(input)).toBe(true);
  });

  it('незмінена вкладка не потрапляє в texts', () => {
    const now = was();
    now.texts.en!.name = 'Cable v2';
    const { input } = buildSaveInput(was(), now);
    expect(input.texts).toEqual({ en: { name: 'Cable v2' } });
    expect(input.texts).not.toHaveProperty('uk');
  });

  it('очищене поле йде як null, а не порожній рядок', () => {
    const base = was();
    base.texts.en!.metaTitle = 'T';
    const now = structuredClone(base);
    now.texts.en!.metaTitle = '';
    expect(buildSaveInput(base, now).input.texts).toEqual({
      en: { metaTitle: null },
    });
  });

  it('база: лише змінені поля; розділ "" → null', () => {
    const base = was();
    base.sectionId = 'a';
    const now = { ...base, sectionId: '', isFeatured: true };
    expect(buildSaveInput(base, now).input.base).toEqual({
      sectionId: null,
      isFeatured: true,
    });
  });

  it('перемикання на «з модифікаціями» скидає sku і ставить in_stock', () => {
    const base = { ...was(), sku: 'X', stockStatus: 'out_of_stock' as const };
    const now = { ...base, hasModifications: true };
    expect(buildSaveInput(base, now).input.base).toEqual({
      hasModifications: true,
      sku: null,
      stockStatus: 'in_stock',
    });
  });

  it('нова модифікація потрапляє в modifications.upsert того ж запиту, індекс запам’ятано', () => {
    const now = {
      ...was(),
      modifications: [mod(M1, { texts: { uk: '100W' } })],
    };
    const { input, index } = buildSaveInput(was(), now);
    expect(input.modifications?.upsert).toEqual([
      { id: M1, sortOrder: 0, texts: { uk: { name: '100W' } } },
    ]);
    expect(index.modifications).toEqual([M1]);
  });

  it('змінена модифікація шле лише змінені поля; незмінена не шле нічого', () => {
    const base = {
      ...was(),
      modifications: [mod(M1), mod(M2, { sortOrder: 1 })],
    };
    const now = structuredClone(base);
    now.modifications[0]!.sku = 'S-1';
    const { input } = buildSaveInput(base, now);
    expect(input.modifications?.upsert).toEqual([{ id: M1, sku: 'S-1' }]);
  });

  it('видалена модифікація — у remove, її фото й значення не йдуть (каскад)', () => {
    const base = {
      ...was(),
      modifications: [mod(M1)],
      images: [
        {
          id: I1,
          storageKey: 'k',
          sortOrder: 0,
          modificationId: M1,
          alt: {},
          overrides: {},
        },
      ],
      propertyValues: [
        {
          id: V1,
          propertyId: P1,
          kind: 'boolean' as const,
          bool: true,
          modificationId: M1,
        },
      ],
    };
    const now = { ...base, modifications: [], images: [], propertyValues: [] };
    const { input } = buildSaveInput(base, now);
    expect(input.modifications).toEqual({ remove: [M1] });
    expect(input.images).toBeUndefined();
    expect(input.propertyValues).toBeUndefined();
  });

  it('значення властивості: нове — upsert, прибране — remove, індекс за propertyId', () => {
    const base = {
      ...was(),
      propertyValues: [
        { id: V1, propertyId: P1, kind: 'color' as const, color: '#000000' },
      ],
    };
    const added = {
      ...base,
      propertyValues: [
        ...base.propertyValues,
        { id: M2, propertyId: M1, kind: 'boolean' as const, bool: false },
      ],
    };
    expect(buildSaveInput(base, added).index.propertyValues).toEqual([M1]);
    const gone = { ...base, propertyValues: [] };
    expect(buildSaveInput(base, gone).input.propertyValues).toEqual({
      remove: [V1],
    });
  });

  it('фото: нове — upsert, змінений порядок — upsert, прибране — remove', () => {
    const img = (id: string, sortOrder: number) => ({
      id,
      storageKey: `k${id}`,
      sortOrder,
      alt: {},
      overrides: {},
    });
    const base = { ...was(), images: [img(I1, 0), img(M1, 1)] };
    const now = { ...base, images: [img(M1, 0), img(M2, 1)] };
    const { input } = buildSaveInput(base, now);
    expect(input.images?.remove).toEqual([I1]);
    expect(input.images?.upsert?.map((i) => i.id)).toEqual([M1, M2]);
  });
});

describe('buildSaveInput: статус модифікації й текст значення', () => {
  it('змінений статус модифікації йде в upsert, типовий для нової — ні', () => {
    const base = { ...was(), modifications: [mod(M1)] };
    const now = structuredClone(base);
    now.modifications[0]!.stockStatus = 'on_order';
    expect(buildSaveInput(base, now).input.modifications?.upsert).toEqual([
      { id: M1, stockStatus: 'on_order' },
    ]);
    const fresh = { ...was(), modifications: [mod(M2)] };
    expect(
      buildSaveInput(was(), fresh).input.modifications?.upsert?.[0],
    ).not.toHaveProperty('stockStatus');
  });

  it('незмінена мова значення не йде (інакше сервер зробив би її «актуальною»)', () => {
    const val = (text: Record<string, string | null>) => ({
      id: V1,
      propertyId: P1,
      kind: 'text' as const,
      text,
    });
    const base = {
      ...was(),
      propertyValues: [val({ uk: 'мідь', en: 'copper' })],
    };
    const now = {
      ...base,
      propertyValues: [val({ uk: 'алюміній', en: 'copper' })],
    };
    expect(buildSaveInput(base, now).input.propertyValues?.upsert).toEqual([
      val({ uk: 'алюміній' }),
    ]);
  });

  it('нове текстове значення йде всіма непорожніми мовами', () => {
    const now = {
      ...was(),
      propertyValues: [
        {
          id: V1,
          propertyId: P1,
          kind: 'text' as const,
          text: { uk: 'a', en: null },
        },
      ],
    };
    expect(
      buildSaveInput(was(), now).input.propertyValues?.upsert?.[0]?.text,
    ).toEqual({ uk: 'a' });
  });
});

describe('same', () => {
  it('ігнорує ключі зі значенням undefined, розрізняє вкладене', () => {
    expect(same({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(same({ a: { b: [1] } }, { a: { b: [2] } })).toBe(false);
  });
});

describe('buildCreateInput', () => {
  it('лише непорожні тексти; адреса — якщо задана; з модифікаціями sku не йде', () => {
    const v = was();
    v.path = 'cable';
    v.hasModifications = true;
    v.sku = 'X';
    const out = buildCreateInput(P1, v);
    expect(out.texts).toEqual({
      uk: { name: 'Кабель' },
      en: { name: 'Cable' },
    });
    expect(out).toMatchObject({
      id: P1,
      path: 'cable',
      sku: null,
      stockStatus: 'in_stock',
    });
  });
});

describe('rebase / withStockStatus', () => {
  it('поле, змінене після відправки, лишається; решта — з БД', () => {
    const sent = was();
    const fresh = structuredClone(sent);
    fresh.texts.uk!.name = 'З БД';
    fresh.texts.en!.name = 'DB en';
    const now = structuredClone(sent);
    now.texts.uk!.name = 'Введене пізніше';
    now.isFeatured = true;
    const out = rebase(fresh, sent, now);
    expect(out.texts.uk!.name).toBe('Введене пізніше');
    expect(out.texts.en!.name).toBe('DB en');
    expect(out.isFeatured).toBe(true);
  });

  it('колекція, змінена після відправки, береться цілком', () => {
    const sent = was();
    const now = { ...sent, modifications: [mod(M1)] };
    expect(rebase(was(), sent, now).modifications).toHaveLength(1);
    expect(rebase(was(), sent, sent).modifications).toEqual([]);
  });

  it('withStockStatus міняє товар або лише вказану модифікацію', () => {
    const f = { ...was(), modifications: [mod(M1), mod(M2)] };
    expect(withStockStatus(f, null, 'on_order').stockStatus).toBe('on_order');
    const g = withStockStatus(f, M2, 'out_of_stock');
    expect(g.modifications.map((m) => m.stockStatus)).toEqual([
      'in_stock',
      'out_of_stock',
    ]);
  });
});
