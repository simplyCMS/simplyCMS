import { describe, expect, it } from 'vitest';
import { blankForm } from '../product-aggregate';
import { productFormSchemaFor } from '../product-form-schema';

const form = (patch: (f: ReturnType<typeof blankForm>) => void) => {
  const f = blankForm(['uk', 'en']);
  patch(f);
  return productFormSchemaFor('uk').safeParse(f);
};

describe('productFormSchemaFor: назва основною мовою й формат адреси', () => {
  it('порожня назва основної мови — помилка на texts.uk.name', () => {
    const r = form(() => undefined);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['texts', 'uk', 'name']);
  });

  it('назва лише з пробілів — теж помилка', () => {
    expect(form((f) => (f.texts.uk!.name = '   ')).success).toBe(false);
  });

  it('порожні тексти інших мов — не помилка', () => {
    expect(form((f) => (f.texts.uk!.name = 'Кабель')).success).toBe(true);
  });

  it('адреса у форматі slug — ок, з пробілом і великими — помилка', () => {
    const base = (f: ReturnType<typeof blankForm>) => (f.texts.uk!.name = 'К');
    expect(form((f) => (base(f), (f.path = 'wire-100'))).success).toBe(true);
    const bad = form((f) => (base(f), (f.path = 'Bad Slug')));
    expect(bad.error?.issues[0]?.path).toEqual(['path']);
  });
});
