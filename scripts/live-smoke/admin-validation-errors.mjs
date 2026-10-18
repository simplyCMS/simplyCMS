/**
 * Крок Теми 12 — помилка валідації serverFn адмінки як помилка ПОЛЯ (борг №15).
 * Власник зберігає залишок 1 000 001 (бізнес-ліміт — 1 000 000): справжній
 * HTTP-шлях (форма → `saveStock` → валідатор `adminInput` → `ValidationError`
 * → `domainErrorAdapter` → `applyServerValidation`) має показати
 * ЛОКАЛІЗОВАНЕ повідомлення під полем, а не сирий JSON у тості; у БД
 * залишок не з'являється. Засів — один товар із модифікацією, прибирається
 * у `finally`.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';
import { deleteProductsByPrefix, seedProducts } from './product-rows.mjs';
import { sectionBySlug } from './admin-sql.mjs';
import { expectCount } from './wait.mjs';

const MESSAGE = 'Значення завелике: не більше 1000000';

export async function runAdminValidationErrorsStep({
  context,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const tag = randomUUID().slice(0, 6);
  const name = `Валід ${tag}`;
  const modId = randomUUID();
  try {
    const section = await sectionBySlug(dbUrl, 'sonyachni-paneli');
    await seedProducts(dbUrl, {
      prefix: `ve-${tag}`,
      nameSql: `'${name}'`,
      count: 1,
      sectionId: section.id,
      createdSql: 'now()',
    });
    const [{ id: productId }] = await sql(
      dbUrl,
      `select product_id as id from public.url_paths where path = $1`,
      [`ve-${tag}1`],
    );
    await sql(
      dbUrl,
      // М1-TEMP: зноситься в Task 17 — `product_modifications.slug`/`name` ще NOT NULL.
      `insert into public.product_modifications (id, product_id, slug, name) values ($1, $2, $3, $4)`,
      [modId, productId, `ve-mod-${tag}`, `Мод ${tag}`],
    );
    await sql(
      dbUrl,
      `insert into public.product_modification_translations (product_id, modification_id, locale, name) values ($1, $2, 'uk', $3)`,
      [productId, modId, `Мод ${tag}`],
    );

    await page.goto(`${base}/admin/products/${productId}`, {
      waitUntil: 'networkidle',
    });
    await page.locator('tr', { hasText: `Мод ${tag}` }).click();
    await page.locator('#stock-quantity').fill('1000001');
    await page.getByRole('button', { name: 'Зберегти залишки' }).click();

    const field = page.getByText(MESSAGE);
    await field.waitFor({ timeout: 10_000 });
    const oneMessage = await expectCount(field, 1);
    const body = (await page.locator('body').innerText()).toString();
    const [{ count }] = await sql(
      dbUrl,
      `select count(*)::int as count from public.stock_by_pickup_point where modification_id = $1`,
      [modId],
    );
    check(
      'валідація: залишок 1 000 001 → локалізована помилка поля, без сирого JSON',
      oneMessage &&
        (await page.locator('#stock-quantity').getAttribute('aria-invalid')) ===
          'true' &&
        !/"code"|"path"|too_big|invalid_type/.test(body) &&
        count === 0,
      `поле: ${oneMessage ? 1 : '≠1'}, рядків залишку в БД: ${count}`,
    );
    check(
      'валідація: адмін pageerror = 0',
      errors.length === 0,
      errors.join(' | '),
    );
  } finally {
    for (const q of [
      `delete from public.stock_by_pickup_point where modification_id = '${modId}'`,
      `delete from public.product_modifications where id = '${modId}'`,
    ])
      await sql(dbUrl, q).catch(() => {});
    await deleteProductsByPrefix(sql, dbUrl, `ve-${tag}`).catch(() => {});
    await page.close().catch(() => {});
  }
}
