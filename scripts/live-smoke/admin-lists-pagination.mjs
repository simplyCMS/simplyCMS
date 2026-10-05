/**
 * Крок Етапу A «Фундамент даних адмінки» — живий доказ пагінації списків
 * `/admin/products` і `/admin/orders` на TanStack DB 0.11.3: понад сторінку
 * (50) рядків із ОДНАКОВИМИ `created_at` на межі 50/51 → «Показати ще» → жодної
 * втрати чи дубля, множина id у DOM = множина в SQL; жодної відповіді
 * `_serverFn` зі статусом ≥ 400 (до фіксу контракту subset це був 400/500).
 * Засів прибирається у `finally`, щоб не зачепити інші кроки.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';
import { sectionBySlug } from './admin-sql.mjs';

const PAGE = 50;
const SEEDED = 55;
/** Ціна по рядку: i < 46 — унікальні мітки, 46..55 — одна спільна (межа 50/51). */
const TS = `now() + interval '1 hour' + make_interval(secs => case when i >= 46 then 100 else 200 - i end)`;

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** Клік «Показати ще», доки кнопка є; повертає знімок ключів рядків. */
async function loadAll({ page, url, rowKeys, loadMore }) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.querySelectorAll('tbody tr').length >= 50,
  );
  const first = await rowKeys(page);
  const button = page.getByRole('button', { name: loadMore });
  // Кнопка зникає, коли сторінок більше немає; поки триває підвантаження,
  // вона disabled — чекаємо, а не клікаємо (інакше клік гониться з ремонтом DOM).
  for (let clicks = 0, tries = 0; tries < 200; tries++) {
    if (!(await button.isVisible().catch(() => false))) break;
    if (!(await button.isEnabled().catch(() => false))) {
      await page.waitForTimeout(150);
      continue;
    }
    const n = (await rowKeys(page)).length;
    await button.click({ timeout: 5_000 }).catch(() => {});
    await page
      .waitForFunction(
        (prev) => document.querySelectorAll('tbody tr').length > prev,
        n,
        { timeout: 3_000 },
      )
      .catch(() => {});
    if (++clicks > 5) break;
  }
  return { first, all: await rowKeys(page) };
}

export async function runAdminListsPaginationStep({
  context,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const bad = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => {
    if (r.url().includes('_serverFn') && r.status() >= 400)
      bad.push(`${r.status()} ${r.url().slice(-60)}`);
  });
  const tag = randomUUID().slice(0, 6);
  try {
    const section = await sectionBySlug(dbUrl, 'sonyachni-paneli');
    await sql(
      dbUrl,
      `insert into public.products (id, slug, name, section_id, created_at, updated_at)
       select gen_random_uuid(), 'pg-${tag}-' || i, 'Пагін ${tag} ' || lpad(i::text, 3, '0'), $1, ${TS}, ${TS}
         from generate_series(1, ${SEEDED}) i`,
      [section.id],
    );
    await sql(
      dbUrl,
      `insert into public.orders (id, order_number, first_name, last_name, email, phone,
                                  payment_method, subtotal, total, access_token, created_at, updated_at)
       select gen_random_uuid(), 'PG-${tag}-' || i, 'Пагін', 'Тест', 'pg-${tag}-' || i || '@example.test',
              '+380000000000', 'cash', 1, 1, 'pg-${tag}-' || i || '-' || gen_random_uuid(), ${TS}, ${TS}
         from generate_series(1, ${SEEDED}) i`,
    );

    const lists = [
      {
        name: 'товари',
        url: `${base}/admin/products`,
        loadMore: 'Показати ще',
        rowKeys: (p) => p.locator('tbody tr td.font-medium').allTextContents(),
        expected: async () =>
          (await sql(dbUrl, `select name from public.products`)).map(
            (r) => r.name,
          ),
      },
      {
        name: 'замовлення',
        url: `${base}/admin/orders`,
        loadMore: 'Показати ще',
        rowKeys: (p) =>
          p
            .locator('tbody tr a[href*="/admin/orders/"]')
            .evaluateAll((as) =>
              as.map((a) => a.getAttribute('href').split('/').pop()),
            ),
        expected: async () =>
          (await sql(dbUrl, `select id from public.orders`)).map((r) => r.id),
      },
    ];
    for (const l of lists) {
      const { first, all } = await loadAll({ page, ...l });
      const expected = new Set(await l.expected());
      const unique = new Set(all);
      check(
        `пагінація ${l.name}: перша сторінка рівно ${PAGE}`,
        first.length === PAGE,
        `${first.length}`,
      );
      check(
        `пагінація ${l.name}: після «Показати ще» > ${PAGE}, id унікальні, множина = SQL (межа рівних created_at)`,
        all.length > PAGE &&
          unique.size === all.length &&
          sameSet(unique, expected),
        `UI ${all.length} (унікальних ${unique.size}), SQL ${expected.size}`,
      );
    }
    check(
      'пагінація: жодної відповіді _serverFn ≥ 400',
      bad.length === 0,
      bad.join(' | '),
    );
    check(
      'пагінація: адмін pageerror = 0',
      errors.length === 0,
      errors.join(' | '),
    );
  } finally {
    await sql(
      dbUrl,
      `delete from public.products where slug like 'pg-${tag}-%'`,
    );
    await sql(
      dbUrl,
      `delete from public.orders where order_number like 'PG-${tag}-%'`,
    );
    await page.close();
  }
}
