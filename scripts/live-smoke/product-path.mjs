/**
 * Р25 на СПРАВЖНЬОМУ збереженому сервері: один канонічний шлях товару.
 *
 * Чому тут, а не юнітом: склейку 301 + `<link rel="canonical">` робить роут
 * `$sectionSlug/$productSlug` разом із SSR-`head()`; чиста `productRedirectTarget`
 * цього не доводить. Товару без розділу в сіді немає, тож крок створює його
 * прямим SQL (id дає викликач — «Категорія A») і прибирає за собою.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';

const NO_SECTION_SLUG = 'all';
const ORPHAN_SLUG = 'smoke-no-section-product';

/** GET без слідування редиректу: статус, `Location`, тіло. */
async function probe(base, path) {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location'),
    html: res.status === 200 ? await res.text() : '',
  };
}

/** Шлях із `Location` (абсолютний чи відносний) без origin. */
const locPath = (loc) => (loc ? new URL(loc, 'http://x').pathname : null);

const canonicalOf = (html) =>
  /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(html)?.[1] ??
  /<link[^>]*href="([^"]*)"[^>]*rel="canonical"/.exec(html)?.[1] ??
  null;

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {string} p.dbUrl
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runProductPathChecks({ base, dbUrl, check }) {
  const [withSection] = await sql(
    dbUrl,
    `select p.slug, s.slug as section from public.products p
       join public.sections s on s.id = p.section_id
      where p.is_active order by p.slug limit 1`,
  );
  const [other] = await sql(
    dbUrl,
    `select slug from public.sections where slug <> $1 order by slug limit 1`,
    [withSection.section],
  );
  await sql(dbUrl, `delete from public.products where slug = $1`, [
    ORPHAN_SLUG,
  ]);
  await sql(
    dbUrl,
    `insert into public.products (id, slug, name, section_id, is_active)
     values ($1, $2, 'Smoke без розділу', null, true)`,
    [randomUUID(), ORPHAN_SLUG],
  );
  try {
    // (а) без розділу: будь-який сегмент → 301 на /catalog/all/<slug>.
    const orphanHref = `/catalog/${NO_SECTION_SLUG}/${ORPHAN_SLUG}`;
    const wrong = await probe(base, `/catalog/anything/${ORPHAN_SLUG}`);
    check(
      'Р25: товар без розділу, чужий сегмент → 301 на /all/',
      wrong.status === 301 && locPath(wrong.location) === orphanHref,
      `${wrong.status} ${wrong.location ?? '—'}`,
    );
    const canon = await probe(base, orphanHref);
    check(
      'Р25: /catalog/all/<slug> товару без розділу → 200',
      canon.status === 200,
      `${canon.status}`,
    );
    check(
      'Р25: canonical товару без розділу — від даних',
      canonicalOf(canon.html) === `${base}${orphanHref}`,
      canonicalOf(canon.html) ?? '—',
    );

    // (б) з розділом під чужим сегментом → 301 на правильний розділ.
    const goodHref = `/catalog/${withSection.section}/${withSection.slug}`;
    const moved = await probe(
      base,
      `/catalog/${other.slug}/${withSection.slug}`,
    );
    check(
      'Р25: товар з розділом під чужим сегментом → 301 на його розділ',
      moved.status === 301 && locPath(moved.location) === goodHref,
      `${moved.status} ${moved.location ?? '—'}`,
    );

    // (в) canonical однаковий для канонічного URL і для URL після редиректу.
    const direct = await probe(base, goodHref);
    const followed = await fetch(
      `${base}/catalog/${other.slug}/${withSection.slug}`,
    );
    const followedCanonical = canonicalOf(await followed.text());
    check(
      'Р25: canonical однаковий для канонічного і для URL після редиректу',
      canonicalOf(direct.html) === `${base}${goodHref}` &&
        followedCanonical === `${base}${goodHref}`,
      `${canonicalOf(direct.html) ?? '—'} | ${followedCanonical ?? '—'}`,
    );
  } finally {
    await sql(dbUrl, `delete from public.products where slug = $1`, [
      ORPHAN_SLUG,
    ]);
  }
}
