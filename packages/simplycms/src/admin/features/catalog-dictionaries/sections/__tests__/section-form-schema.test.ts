import { describe, expect, it } from 'vitest';
import {
  sectionFormSchema,
  toSectionDraft,
  toSectionPatch,
} from '../section-form-schema';

const ok = {
  name: 'Ноутбуки',
  slug: 'laptops',
  description: '',
  metaTitle: ' ',
  metaDescription: '',
  sortOrder: '2',
  isActive: true,
  images: [] as string[],
};

describe('sectionFormSchema', () => {
  it('валідне проходить, sortOrder коерситься, порожнє → null', () => {
    const r = sectionFormSchema.parse(ok);
    expect(r.sortOrder).toBe(2);
    const p = toSectionPatch(r);
    expect(p.metaTitle).toBeNull();
    expect(p.description).toBeNull();
    expect(p.imageUrl).toBeNull();
  });
  it('кирилиця в slug і >1 зображення відбиваються', () => {
    expect(
      sectionFormSchema.safeParse({ ...ok, slug: 'Ноутбуки' }).success,
    ).toBe(false);
    expect(
      sectionFormSchema.safeParse({ ...ok, images: ['a', 'b'] }).success,
    ).toBe(false);
  });
  it('draft: parentId завжди null', () => {
    const d = toSectionDraft(sectionFormSchema.parse(ok), 'id-1', new Date());
    expect(d.parentId).toBeNull();
    expect(d.id).toBe('id-1');
  });
});
