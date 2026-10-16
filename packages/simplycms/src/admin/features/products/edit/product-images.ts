import type { DraftImage } from './product-form-schema';

/**
 * Фото картки — рядки `images` агрегата; `scope` — id модифікації або
 * `undefined` для фото самого товару. `ImageUpload` працює зі списком ключів
 * сховища, тож тут перетворення туди й назад: наявні рядки зберігають `id`,
 * `alt` і мовні перевизначення, нові ключі отримують свіжий `id`.
 */
const inScope = (i: DraftImage, scope: string | undefined) =>
  i.modificationId === scope;

export function imageKeys(
  images: readonly DraftImage[],
  scope: string | undefined,
): string[] {
  return images
    .filter((i) => inScope(i, scope))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => i.storageKey);
}

export function withScopedImages(
  images: readonly DraftImage[],
  scope: string | undefined,
  keys: readonly string[],
): DraftImage[] {
  const mine = images.filter((i) => inScope(i, scope));
  const rest = images.filter((i) => !inScope(i, scope));
  const next = keys.map((storageKey, sortOrder): DraftImage => {
    const found = mine.find((i) => i.storageKey === storageKey);
    return found
      ? { ...found, sortOrder }
      : {
          id: crypto.randomUUID(), // контракт id: ключ генерує клієнт
          storageKey,
          sortOrder,
          ...(scope && { modificationId: scope }),
          alt: {},
          overrides: {},
        };
  });
  return [...rest, ...next];
}
