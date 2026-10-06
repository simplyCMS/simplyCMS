import type { StorefrontProfile } from 'simplycms/contracts/store-profile';

/** Скрипт для `head().scripts` роуту. */
export type JsonLdScript = { type: 'application/ld+json'; children: string };

/**
 * JSON у `<script>`: кожен `<` → `<`. Назву пише власник у формі, і
 * `</script>` у ній інакше закрив би тег та віддав решту як HTML. JSON-парсер
 * читає `<` як той самий символ, тож значення не змінюється.
 */
export function serializeJsonLd(data: Record<string, unknown>): JsonLdScript {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data).replace(/</g, '\\u003c'),
  };
}

/**
 * Абсолютний URL відносно сайту. Невалідний `siteUrl` (без схеми — помилка
 * env власника) дає `null`, а не виняток: зламаний `head()` прибрав би з
 * головної ще й title.
 */
function absoluteUrl(path: string, siteUrl: string): string | null {
  try {
    return new URL(path, siteUrl).href;
  } catch {
    return null;
  }
}

/**
 * schema.org `Organization` головної з профілю магазину (Е6б-10).
 *
 * `null`/порожні поля не серіалізуються: порожній рядок у JSON-LD — шум для
 * пошуковика. Без `siteUrl` (порожній `VITE_SITE_URL`) немає ні `url`, ні
 * `logo`: відносна адреса в structured data невалідна.
 *
 * `logo` резолвиться через `URL`, а не конкатенацією: `logoUrl` буває й
 * абсолютним (`resolveMediaUrl` лишає `https:`-референс як є), і склейка дала
 * б `https://shop.examplehttps://…`.
 */
export function buildOrganizationJsonLd(
  profile: StorefrontProfile,
  siteUrl: string,
): JsonLdScript {
  const { phone, email, address } = profile.contacts;
  const optional: Record<string, unknown> = {
    url: siteUrl || null,
    logo:
      siteUrl && profile.logoUrl ? absoluteUrl(profile.logoUrl, siteUrl) : null,
    telephone: phone,
    email,
    address,
    sameAs: profile.socials.map((s) => s.url),
  };
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.name,
  };
  for (const [key, value] of Object.entries(optional)) {
    const empty = Array.isArray(value) ? value.length === 0 : !value;
    if (!empty) data[key] = value;
  }
  return serializeJsonLd(data);
}
