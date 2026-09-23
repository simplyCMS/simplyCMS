/**
 * Друга половина кроку каталогу адмінки (К3-Е3): вітрина бачить щойно
 * створений товар, дубль slug дає локалізований тост, видалення прибирає
 * товар з вітрини. Виніс із `admin-catalog.mjs` — канон 150 рядків.
 */
import { productCountBySlug } from './admin-sql.mjs';
import { parseMoney } from './selectors.mjs';

/**
 * @param {{page: import('@playwright/test').Page, base: string,
 *   check: Function, section: {slug: string, name: string}, slug: string}} args
 */
export async function verifyStorefront({ page, base, check, section, slug }) {
  const res = await page.goto(`${base}/catalog/${section.slug}/${slug}`, {
    waitUntil: 'networkidle',
  });
  const text = (await page.locator('main').textContent()) ?? '';
  check(
    'вітрина: картка 200 з назвою',
    res?.status() === 200 && text.includes('Живий товар Е3'),
    String(res?.status()),
  );
  // 🔴 `formatPrice` (domain/money.ts) НЕ доповнює зайвими нулями за
  // дизайном (0/2: 1234.5 → «1 234,5», не «1 234,50») — числове порівняння
  // через `parseMoney`, не рядковий регекс на конкретну кількість знаків.
  const priceMatch = text.match(/1[\s ]?234[,.]\d+/);
  check(
    'вітрина: ціна 1234,50',
    priceMatch !== null && parseMoney(priceMatch[0]) === 1234.5,
    priceMatch?.[0] ?? '—',
  );
  check(
    'вітрина: бейдж «В наявності: 3 шт»',
    text.includes('В наявності: 3 шт'),
    '',
  );
  const img = await page
    .locator('main img[src^="/media/"]')
    .first()
    .getAttribute('src');
  check(
    'вітрина: зображення з /media',
    Boolean(img) && (await page.request.get(`${base}${img}`)).status() === 200,
    img ?? '—',
  );
}

/** Review Focus 1 наживо: дубль slug — зрозумілий тост, не текст SQL. */
export async function verifyDuplicateSlugToast({
  page,
  base,
  check,
  section,
  slug,
}) {
  await page.goto(`${base}/admin/products/new`, { waitUntil: 'networkidle' });
  await page.locator('#product-name').fill('Дубль');
  await page.locator('#product-slug').fill(slug);
  await page.locator('#product-section').click();
  await page.getByRole('option', { name: section.name }).click();
  await page.getByRole('button', { name: 'Створити' }).click();
  // 🔴 НЕ `.isVisible({ timeout })`: `timeout` там deprecated і мовчки
  // ігнорується (Playwright не чекає появи, читає DOM ОДРАЗУ) — гонка
  // проти асинхронного 409+тосту, спіймана живим прогоном Е3-20.
  // `.waitFor({ state: 'visible' })` реально чекає й ретраїть.
  const toast = page.getByText('Такий URL (slug) уже зайнятий');
  check(
    'адмін: дубль slug → тост i18n',
    await toast
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false),
    '',
  );
}

/** Видалення в списку прибирає рядок оптимістично і товар з вітрини (204/404). */
export async function verifyDelete({
  page,
  base,
  dbUrl,
  check,
  section,
  slug,
}) {
  await page.goto(`${base}/admin/products`, { waitUntil: 'networkidle' });
  await page
    .getByRole('row', { name: /Живий товар Е3/ })
    .getByRole('button')
    .last()
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити' })
    .click();
  // Детерміновано: рядок зник із таблиці = оптимістичне видалення
  // підтверджене сервером (rollback повернув би його назад).
  await page
    .getByRole('row', { name: /Живий товар Е3/ })
    .waitFor({ state: 'detached', timeout: 10_000 });
  const gone = await page.goto(`${base}/catalog/${section.slug}/${slug}`);
  const left = await productCountBySlug(dbUrl, slug);
  check(
    'адмін: видалення → вітрина 404, рядка немає',
    gone?.status() === 404 && left === 0,
    `${gone?.status()} / ${left}`,
  );
}
