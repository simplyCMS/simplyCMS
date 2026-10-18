import type { CartQuoteLine } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import type { CartItem } from 'simplycms/react-query';

/**
 * Яку мініатюру показати в рядку кошика (М1, Task 17б). `undefined` — скелетон; `null` — фото
 * немає (іконка-заглушка). Правило — те саме, що для назв (`resolveCartItemNames`, Task 16):
 * фото теж перевизначається для мови, тож кеш іншої мови — не плейсхолдер.
 * 1. Рядок квоти є — фото з квоти (мова сторінки, той самий читач, що сторінка товару).
 * 2. Квоти ще немає, кеш тієї ж мови (`namesLocale`), що сторінка — кеш.
 * 3. Кеш ІНШОЇ мови — скелетон (додав на `/`, відкрив `/en/cart` з перевизначеним фото en).
 * 4. Квота впала / рядок недоступний — кеш, але непорожній alt отримує `lang` мови, у якій
 *    його збережено (чесна розмітка замість мовчазної підміни, як у назв).
 */
export function resolveCartItemImage(
  item: CartItem,
  line: CartQuoteLine | null,
  pageLocale: string,
  failed: boolean,
): ProductImageViewModel | null | undefined {
  if (line?.available) return line.image;
  const cached = item.image ?? null;
  if (item.namesLocale === pageLocale) return cached;
  if (failed || line !== null)
    return cached && cached.alt !== ''
      ? { ...cached, alt_lang: cached.alt_lang ?? item.namesLocale ?? null }
      : cached;
  return undefined;
}
