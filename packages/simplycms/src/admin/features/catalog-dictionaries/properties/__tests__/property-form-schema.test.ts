import { describe, expect, it } from 'vitest';
import {
  PROPERTY_TYPES,
  propertyFormSchema,
  toPropertyDraft,
  toPropertyPatch,
} from '../property-form-schema';
import { optionFormSchema, toOptionDraft } from '../option-form-schema';

const valid = {
  name: 'Бренд',
  slug: 'brand',
  propertyType: 'select',
  isRequired: false,
  isFilterable: true,
  hasPage: false,
  sortOrder: '3',
};

describe('propertyFormSchema', () => {
  it('тип — рівно 7 значень enum-у БД', () => {
    expect([...PROPERTY_TYPES]).toEqual([
      'text',
      'number',
      'select',
      'multiselect',
      'range',
      'color',
      'boolean',
    ]);
    expect(
      propertyFormSchema.safeParse({ ...valid, propertyType: 'json' }).success,
    ).toBe(false);
  });

  it('кириличний slug і порожня назва відбиваються', () => {
    expect(
      propertyFormSchema.safeParse({ ...valid, slug: 'Бренд' }).success,
    ).toBe(false);
    expect(propertyFormSchema.safeParse({ ...valid, name: ' ' }).success).toBe(
      false,
    );
  });

  it('patch НЕ несе propertyType (Е4-5), draft — несе й sectionId null', () => {
    const v = propertyFormSchema.parse(valid);
    expect(v.sortOrder).toBe(3);
    expect('propertyType' in toPropertyPatch(v)).toBe(false);
    const draft = toPropertyDraft(v, 'id-1', new Date(0));
    expect(draft.propertyType).toBe('select');
    expect(draft.sectionId).toBeNull();
    expect(draft.options).toBeNull();
  });
});

describe('optionFormSchema', () => {
  const opt = {
    name: 'Samsung',
    slug: 'samsung',
    sortOrder: 0,
    description: '',
    metaTitle: '',
    metaDescription: '',
    images: ['property_option/x/a.png'],
  };
  it('кириличний slug відбивається, images ≤ 1', () => {
    expect(
      optionFormSchema.safeParse({ ...opt, slug: 'самсунг' }).success,
    ).toBe(false);
    expect(
      optionFormSchema.safeParse({ ...opt, images: ['a', 'b'] }).success,
    ).toBe(false);
  });
  it('draft: propertyId, imageUrl з першого референсу, порожній текст → null', () => {
    const d = toOptionDraft(
      optionFormSchema.parse(opt),
      'o1',
      'p1',
      new Date(0),
    );
    expect(d).toMatchObject({
      id: 'o1',
      propertyId: 'p1',
      imageUrl: 'property_option/x/a.png',
      description: null,
      metaTitle: null,
      metaDescription: null,
    });
  });
});
