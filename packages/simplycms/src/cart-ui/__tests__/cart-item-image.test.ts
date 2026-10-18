import { describe, expect, it } from 'vitest';
import type { CartQuoteLine } from 'simplycms/contracts';
import type { CartItem } from 'simplycms/react-query';
import { resolveCartItemImage } from '../cart-item-image';

// М1 Task 17б fix-1 (I2): правило вибору мініатюри рядка кошика — те саме, що для назв.
const ITEM: CartItem = {
  productId: 'p',
  modificationId: null,
  name: 'Кабель',
  namesLocale: 'uk',
  quantity: 1,
  image: { url: '/media/uk.png', alt: 'Кабель спереду' },
};
const EN = { url: '/media/en.png', alt: 'Cable front', alt_lang: null };
const LINE: CartQuoteLine = {
  available: true,
  productId: 'p',
  modificationId: null,
  quantity: 1,
  name: 'Cable',
  productName: 'Cable',
  modificationName: null,
  productNameLang: null,
  modificationNameLang: null,
  image: EN,
  basePrice: 1,
  price: 1,
  applied: [],
  hints: [],
};

describe('resolveCartItemImage', () => {
  it('рядок квоти є — фото квоти, навіть коли кеш іншої мови чи тієї ж', () => {
    expect(resolveCartItemImage(ITEM, LINE, 'en', false)).toBe(EN);
    expect(resolveCartItemImage(ITEM, LINE, 'uk', false)).toBe(EN);
    expect(
      resolveCartItemImage(ITEM, { ...LINE, image: null }, 'en', false),
    ).toBeNull();
  });

  it('квоти немає: кеш тієї ж мови — кеш; іншої — скелетон (undefined)', () => {
    expect(resolveCartItemImage(ITEM, null, 'uk', false)).toBe(ITEM.image);
    expect(resolveCartItemImage(ITEM, null, 'en', false)).toBeUndefined();
  });

  it('квота впала чи рядок недоступний — кеш з lang мови кешу', () => {
    const lang = { ...ITEM.image, alt_lang: 'uk' };
    expect(resolveCartItemImage(ITEM, null, 'en', true)).toEqual(lang);
    expect(
      resolveCartItemImage(
        ITEM,
        { available: false, productId: 'p', modificationId: null, quantity: 1 },
        'en',
        false,
      ),
    ).toEqual(lang);
  });
});
