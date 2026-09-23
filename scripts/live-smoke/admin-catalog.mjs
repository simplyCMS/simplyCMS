/**
 * Крок К3-Е3 — ЄДИНИЙ живий доказ каталогу адмінки: запрошення власника →
 * пароль → вхід → товар створено в адмінці (з ціною через кому, залишком і
 * зображенням) → він на вітрині з цією ціною, бейджем і картинкою → дубль
 * slug дає зрозумілий тост → видалення прибирає його з вітрини.
 * Окремий browser context: сесія покупця воронки не змішується з адмінською.
 *
 * Вітрина/дубль/видалення — `./admin-catalog-verify.mjs` (канон 150 рядків).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  priceTypeByCode,
  productBySlug,
  productPrice,
  productStockAndImages,
  sectionBySlug,
} from './admin-sql.mjs';
import {
  verifyDelete,
  verifyDuplicateSlugToast,
  verifyStorefront,
} from './admin-catalog-verify.mjs';
import { PNG } from './avatar.mjs';

const PASSWORD = 'live-smoke-owner-2026';

export async function runAdminCatalogStep({
  browser,
  base,
  dbUrl,
  storeEnv,
  check,
}) {
  const email = `owner-${randomUUID().slice(0, 8)}@example.test`;
  const { url } = JSON.parse(
    execFileSync(
      'pnpm',
      [
        'exec',
        'tsx',
        join(import.meta.dirname, 'owner-invite.mts'),
        email,
        base,
      ],
      { env: { ...process.env, ...storeEnv }, encoding: 'utf8' },
    ),
  );

  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // 1. Запрошення → пароль → /admin.
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Повторіть пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Зберегти і продовжити' }).click();
    await page.waitForURL(`${base}/admin`, { timeout: 15_000 });
    check('адмін: запрошення → пароль → /admin', true, email);

    // 2. Новий товар у демо-розділі.
    const section = await sectionBySlug(dbUrl, 'sonyachni-paneli');
    const slug = `live-e3-${randomUUID().slice(0, 6)}`;
    await page.goto(`${base}/admin/products/new`, { waitUntil: 'networkidle' });
    await page.locator('#product-name').fill('Живий товар Е3');
    await page.locator('#product-slug').fill(slug);
    await page.locator('#product-section').click();
    await page.getByRole('option', { name: section.name }).click();
    await page.getByRole('button', { name: 'Створити' }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    const productId = page.url().split('/').pop();
    const row = await productBySlug(dbUrl, slug);
    check(
      'адмін: товар у БД з клієнтським id',
      row?.id === productId,
      `${row?.id} vs ${productId}`,
    );

    // 3. Зображення (DoD К3 п.6), ціна з комою, залишок.
    await page.setInputFiles(
      '[data-testid="product-images"] input[type="file"]',
      { name: 'product.png', mimeType: 'image/png', buffer: PNG },
    );
    await page
      .locator('[data-testid="product-images"] img[src^="/media/"]')
      .first()
      .waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Зберегти' }).first().click();
    const retail = await priceTypeByCode(dbUrl, 'retail');
    await page.locator(`#price-${retail.id}`).fill('1234,50');
    await page.getByRole('button', { name: 'Зберегти ціни' }).click();
    await page.locator('#stock-quantity').fill('3');
    await page.getByRole('button', { name: 'Зберегти залишки' }).click();
    const price = await productPrice(dbUrl, productId, retail.id);
    check(
      'адмін: ціна з комою збережена як 1234.50',
      price === '1234.50',
      String(price),
    );
    const stock = await productStockAndImages(dbUrl, productId);
    check(
      'адмін: залишок 3, статус in_stock',
      stock?.quantity === 3 && stock?.stock_status === 'in_stock',
      JSON.stringify(stock),
    );
    check(
      'адмін: у images референс, не URL',
      Array.isArray(stock?.images) &&
        stock.images.length === 1 &&
        !String(stock.images[0]).startsWith('/'),
      JSON.stringify(stock?.images),
    );

    // 4-6. Вітрина / дубль slug / видалення.
    await verifyStorefront({ page, base, check, section, slug });
    await verifyDuplicateSlugToast({ page, base, check, section, slug });
    await verifyDelete({ page, base, dbUrl, check, section, slug });
  } finally {
    await context.close();
  }
}
