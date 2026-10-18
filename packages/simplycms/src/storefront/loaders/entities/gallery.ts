import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { resolveMediaUrl } from 'simplycms/domain/media';

/**
 * Декодує jsonb галереї (`productGallerySql`/`modificationGallerySql`) у фото view-model.
 *
 * 🔴 Єдиний шов для ВСІХ фото товару й модифікації на вітрині (сторінка, галерея
 * модифікації, мініатюри лістингів): референс резолвиться тут, а не на сторінці
 * (`resolveMediaUrl` лишає зовнішні URL і `data:` як є). `alt` без жодного перекладу —
 * `''`, а не назва файлу чи товару: порожній alt — чесне «декоративне», вигаданий —
 * хибний текст для скрінрідера. Колонка — нетипізований jsonb, тож форма перевіряється.
 */
export function toGallery(value: unknown): ProductImageViewModel[] {
  if (!Array.isArray(value)) return [];
  const out: ProductImageViewModel[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { key, alt, alt_lang } = item as Record<string, unknown>;
    const url = typeof key === 'string' ? resolveMediaUrl(key) : null;
    if (url === null) continue;
    out.push({
      url,
      alt: typeof alt === 'string' ? alt : '',
      alt_lang: typeof alt_lang === 'string' ? alt_lang : null,
    });
  }
  return out;
}
