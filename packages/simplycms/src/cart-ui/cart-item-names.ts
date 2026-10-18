import type { CartQuoteLine } from 'simplycms/contracts';
import type { CartItem } from 'simplycms/react-query';

/** Підписи рядка кошика, готові до показу, з ознаками мови для `FallbackText` (І37). */
export interface CartItemNames {
  product: string;
  modification: string | null;
  productLang: string | null;
  modificationLang: string | null;
}

/**
 * Які назви показати в рядку кошика. `null` — скелетон назви.
 *
 * Правило (М1, Task 16 I4): назви збережено в localStorage МОВОЮ, у якій їх отримали
 * (`namesLocale`), а сторінка може бути іншою мовою (додав на `/`, відкрив `/en/cart`).
 * 1. Рядок квоти є — назви з квоти (мова сторінки; fallback-частини мають `lang` основної).
 * 2. Квоти ще немає, але кеш тієї ж мови, що сторінка — кеш (перший кадр без скелета).
 * 3. Кеш ІНШОЇ мови — скелетон: показати його значило б мерехтіння мови й нечесний `lang`.
 * 4. Квота впала / рядок недоступний — скелетон був би вічним, тож показуємо кеш, але з
 *    `lang` мови, у якій його отримано (чесна розмітка замість мовчазної підміни).
 */
export function resolveCartItemNames(
  item: CartItem,
  line: CartQuoteLine | null,
  pageLocale: string,
  failed: boolean,
): CartItemNames | null {
  if (line?.available)
    return {
      product: line.productName,
      modification: line.modificationName,
      productLang: line.productNameLang,
      modificationLang: line.modificationNameLang,
    };
  const cached = {
    product: item.name,
    modification: item.modificationName ?? null,
  };
  if (item.namesLocale === pageLocale)
    return { ...cached, productLang: null, modificationLang: null };
  if (failed || line !== null)
    return {
      ...cached,
      productLang: item.namesLocale ?? null,
      modificationLang: item.namesLocale ?? null,
    };
  return null;
}
