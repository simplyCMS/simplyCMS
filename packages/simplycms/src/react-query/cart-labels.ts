// Підписи рядків кошика з квоти (М1, Task 16 / 17б): назви й мініатюра мовою сторінки
// записуються в збережені рядки під однією міткою `namesLocale`.
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { sameLine, type CartItem } from './cart-normalize';

/** Оновлення підписів рядка з квоти: назви й мініатюра мовою `namesLocale`. */
export interface CartNameUpdate {
  productId: string;
  modificationId: string | null;
  name: string;
  /** `null` — позиція без модифікації. */
  modificationName: string | null;
  /** `null` — фото немає (кешоване прибирається). */
  image: ProductImageViewModel | null;
}

const sameImage = (
  a: ProductImageViewModel | undefined,
  b: ProductImageViewModel | undefined,
): boolean =>
  a?.url === b?.url &&
  a?.alt === b?.alt &&
  (a?.alt_lang ?? null) === (b?.alt_lang ?? null);

/**
 * Записати в рядки назви й мініатюру з квоти разом з їх мовою (одна мітка `namesLocale`). Повертає ТОЙ САМИЙ масив, якщо нічого не
 * змінилось, щоб ефект синхронізації не писав у сховище (і не будив підписників) даремно.
 */
export function applyNameUpdates(
  prev: readonly CartItem[],
  updates: readonly CartNameUpdate[],
  namesLocale: string,
): readonly CartItem[] {
  let changed = false;
  const next = prev.map((item) => {
    const u = updates.find((x) => sameLine(x, item));
    if (!u) return item;
    const modificationName = u.modificationName ?? undefined;
    const image = u.image ?? undefined;
    if (
      item.name === u.name &&
      item.modificationName === modificationName &&
      sameImage(item.image, image) &&
      item.namesLocale === namesLocale
    )
      return item;
    changed = true;
    // Підпис модифікації й фото міняються разом із назвою: старий ключ не лишаємо, нового — без значення.
    const rest: CartItem = { ...item, name: u.name, namesLocale };
    delete rest.modificationName;
    delete rest.image;
    if (modificationName !== undefined)
      rest.modificationName = modificationName;
    if (image !== undefined) rest.image = image;
    return rest;
  });
  return changed ? next : prev;
}
