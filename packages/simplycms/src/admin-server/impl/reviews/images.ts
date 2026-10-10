/**
 * `product_reviews.images` — nullable `jsonb` без CHECK форми (аудит р4 M5):
 * `NULL`, обʼєкт чи масив із не-рядками тут дозволені, тож межа нормалізує
 * значення до `string[]` (не-рядки відкидаються, як `toImageList` вітрини).
 */
export function normalizeImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v !== '')
    : [];
}
