/**
 * Прибирання кроку контенту К3-Е6д (`finally` у `./admin-content.mjs`):
 * банер (якщо лишився), демо-банери знову активні, обидва відгуки, їхні рядки `media` і файли в
 * `MEDIA_ROOT` сервера, покупець кроку. Порядок — «рядки й файли → покупець»:
 * `media.uploaded_by` інакше лишився б сиротою.
 *
 * 🔴 Кожна дія у своєму `try`: збій одного не зриває решту, а факти йдуть в
 * один рядок результату (зразок `./admin-customers-cleanup.mjs`).
 */
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { dropUser } from './admin-customers-seed.mjs';
import { orphans } from './admin-customers-facts.mjs';
import { mediaKeysOf } from './admin-content-sql.mjs';
import { sql } from './sql.mjs';

/**
 * Корінь сховища сервера — те саме правило, що `mediaRoot()` у
 * `simplycms/storage` (`.data/media`, якщо `MEDIA_ROOT` не задано):
 * `server.mjs` стартує з кореня репо й успадковує `process.env` (`startStore`).
 */
const MEDIA_DIR = resolve(
  join(import.meta.dirname, '..', '..'),
  process.env.MEDIA_ROOT ?? '.data/media',
);

async function attempt(facts, what, action) {
  try {
    const result = await action();
    facts.push(`${what}: ${JSON.stringify(result)}`);
    return result === true;
  } catch (e) {
    facts.push(`${what}: виняток ${e.message}`);
    return false;
  }
}

/** Стерти рядки `media` сутності й повернути їхні ключі (файли — окремо). */
async function dropMedia(dbUrl, entityType, entityId) {
  const keys = await mediaKeysOf(dbUrl, entityType, entityId);
  await sql(
    dbUrl,
    'delete from public.media where entity_type = $1 and entity_id = $2',
    [entityType, entityId],
  );
  return keys;
}

export async function cleanupContentStep({ dbUrl, check, st }) {
  const facts = [];
  const results = [];
  if (st.bannerId)
    results.push(
      await attempt(facts, 'банер', async () => {
        st.mediaKeys.push(...(await dropMedia(dbUrl, 'banner', st.bannerId)));
        await sql(dbUrl, 'delete from public.banners where id = $1', [
          st.bannerId,
        ]);
        return true;
      }),
    );
  for (const id of [st.reviewId, st.seededId].filter(Boolean))
    results.push(
      await attempt(facts, `відгук ${id.slice(0, 8)}`, async () => {
        st.mediaKeys.push(...(await dropMedia(dbUrl, 'review', id)));
        await sql(dbUrl, 'delete from public.product_reviews where id = $1', [
          id,
        ]);
        return true;
      }),
    );
  if (st.demoBanners?.length)
    results.push(
      await attempt(facts, 'демо-банери увімкнено', async () => {
        await sql(
          dbUrl,
          'update public.banners set is_active = true where id = any($1)',
          [st.demoBanners],
        );
        return true;
      }),
    );
  results.push(
    await attempt(facts, 'файли кроку', async () => {
      const keys = [...new Set(st.mediaKeys)];
      await Promise.all(
        keys.map((k) => rm(join(MEDIA_DIR, k), { force: true })),
      );
      return true;
    }),
  );
  if (st.buyerId)
    results.push(
      await attempt(facts, 'покупець', async () => {
        await dropUser(dbUrl, st.buyerId);
        return true;
      }),
    );
  results.push(
    await attempt(facts, 'сироти', async () => {
      const found = await orphans(dbUrl);
      return Object.keys(found).length === 0 || found;
    }),
  );
  check(
    'прибирання контенту: банер, відгуки, media, файли, покупець — як до кроку; сиріт немає',
    results.every(Boolean),
    facts.join('; '),
  );
}
