import { describe, expect, it } from 'vitest';
import {
  productFormSchema,
  toProductDraft,
  toProductPatch,
} from '../product-form-schema';

const base = {
  name: 'Панель',
  slug: 'panel',
  shortDescription: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  sectionId: 's1',
  isActive: true,
  isFeatured: false,
  hasModifications: false,
  sku: 'SKU-1',
  stockStatus: 'in_stock' as const,
  images: [] as string[],
};

describe('productFormSchema', () => {
  it('slug — лише латиниця, цифри й дефіс', () => {
    expect(
      productFormSchema.safeParse({ ...base, slug: 'Панель 1' }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({ ...base, slug: 'panel-1' }).success,
    ).toBe(true);
  });

  it('назва обовʼязкова (після trim)', () => {
    expect(productFormSchema.safeParse({ ...base, name: '   ' }).success).toBe(
      false,
    );
  });

  it('порожні необовʼязкові рядки → null у patch (не "" у БД)', () => {
    expect(toProductPatch(base)).toMatchObject({
      shortDescription: null,
      metaTitle: null,
    });
  });

  it('товар із модифікаціями: sku null, stockStatus in_stock (правило легасі ProductEdit.tsx:169-176)', () => {
    expect(toProductPatch({ ...base, hasModifications: true })).toMatchObject({
      sku: null,
      stockStatus: 'in_stock',
    });
  });

  it('МAJOR: простий товар — stockStatus ВІДСУТНІЙ у patch (миттєвий контроль, не форма)', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        toProductPatch({ ...base, hasModifications: false }),
        'stockStatus',
      ),
    ).toBe(false);
  });

  it('розділ необовʼязковий (легасі дозволяв товар без розділу, FK nullable)', () => {
    expect(
      productFormSchema.safeParse({ ...base, sectionId: '' }).success,
    ).toBe(true);
    expect(toProductPatch({ ...base, sectionId: '' })).toMatchObject({
      sectionId: null,
    });
  });

  it('draft несе клієнтський id і повний рядок (оптимістична вставка)', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    const d = toProductDraft(base, 'id-1', now);
    expect(d).toMatchObject({
      id: 'id-1',
      createdAt: now,
      updatedAt: now,
      returnPolicy: null,
      shippingDetails: null,
    });
  });
});
