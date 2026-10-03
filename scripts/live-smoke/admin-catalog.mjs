/**
 * Крок К3-Е3 — ЄДИНИЙ живий доказ каталогу адмінки: товар створено в
 * адмінці (з ціною через кому, залишком і зображенням) → він на вітрині з
 * цією ціною, бейджем і картинкою → дубль slug дає зрозумілий тост →
 * видалення прибирає його з вітрини.
 *
 * Вхід власника — `./owner-session.mjs` (винесено в Е4): крок отримує вже
 * залогінений browser context, відкриває в ньому ВЛАСНУ сторінку з власним
 * лічильником `pageerror` і контекст НЕ закриває — ним далі користується
 * крок довідників (`./admin-dictionaries.mjs`).
 *
 * Вітрина/дубль/видалення — `./admin-catalog-verify.mjs` (канон 150 рядків).
 */
import { randomUUID } from 'node:crypto';
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

export async function runAdminCatalogStep({ context, base, dbUrl, check }) {
  const page = await context.newPage();
  // Окремий лічильник від `errors` воронки покупця (`live-smoke.mjs`) і від
  // кроку довідників — своя сторінка, свій підсумок (Е3-20).
  const adminErrors = [];
  page.on('pageerror', (e) => adminErrors.push(String(e)));
  try {
    // 1. Новий товар у демо-розділі.
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
    // 🔴 URL уже вказує на новий товар (`waitForURL` вище), але сама сторінка
    // ще мить показує ТРАНЗИТНИЙ стан /new (`ImageUpload` з `entityId: null`
    // — виміряно живим прогоном, вікно ~50мс): завантажений у цю мить файл
    // піде БЕЗ entityId і згубиться при ремаунті на реальний `ProductEditPage`.
    // «Зберегти» (не «Створити») існує лише в ЗАВАНТАЖЕНОМУ `ProductEditPage`
    // — детермінований сигнал, що інстанс уже правильний, а не таймаут.
    await page.getByRole('button', { name: 'Зберегти' }).first().waitFor({
      timeout: 15_000,
    });

    // 2. Зображення (DoD К3 п.6), ціна з комою, залишок.
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
    // Тост успіху — детермінований сигнал, що мутація ДОЇХАЛА до БД: без
    // нього прямий SQL нижче races проти ще не завершеного serverFn-запиту
    // (виміряно живим прогоном — «залишок 3» читався як NULL).
    await page.getByText('Ціни збережено').waitFor({ timeout: 10_000 });
    await page.locator('#stock-quantity').fill('3');
    await page.getByRole('button', { name: 'Зберегти залишки' }).click();
    await page.getByText('Залишки збережено').waitFor({ timeout: 10_000 });
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

    // 3-5. Вітрина / дубль slug / видалення.
    await verifyStorefront({ page, base, check, section, slug });
    await verifyDuplicateSlugToast({ page, base, check, section, slug });
    await verifyDelete({ page, base, dbUrl, check, section, slug });

    // 6. Нуль pageerror — підсумок у ту саму таблицю `live-smoke.mjs`.
    check(
      'адмін pageerror за весь крок каталогу',
      adminErrors.length === 0,
      adminErrors.length === 0 ? '0' : adminErrors.join(' | '),
    );
  } finally {
    await page.close();
  }
}
