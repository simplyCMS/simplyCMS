/**
 * Типи цін і прибирання кроку довідників (К3-Е4). Виніс із
 * `./admin-dictionaries.mjs` — канон 150 рядків.
 */
import {
  anyProductSlug,
  assignmentsOfSection,
  priceCountByType,
  priceTypeCount,
  sectionsBySlug,
  seedPricedType,
} from './admin-dictionaries-sql.mjs';
import { waitText } from './selectors.mjs';

const NEW_TYPE = { code: 'live_dict_type', name: 'Живий тип Е4' };
const PRICED = { code: 'live_dict_priced', name: 'Ціновий тип Е4' };

/** Кнопка видалення в рядку таблиці за назвою рядка. */
const deleteButtonOf = (page, rowName) =>
  page
    .getByRole('row', { name: new RegExp(rowName) })
    .getByRole('button', { name: 'Видалити' });

/** Видалення через `AlertDialog` (не `window.confirm`). */
async function confirmDelete(page, rowName) {
  await deleteButtonOf(page, rowName).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити' })
    .click();
}

/**
 * Створити тип → видалити → рядка немає; дефолт `retail` не видаляється
 * (кнопка disabled); тип із цінами → тост `admin.errors.conflictReference`,
 * ціни на місці (Е4-1: RESTRICT, а не мовчазний CASCADE).
 */
export async function runPriceTypesPart({ page, base, dbUrl, check }) {
  // Фікстура ДО відкриття списку: eager-колекція підтягне її першим fetch.
  const productSlug = await anyProductSlug(dbUrl);
  const pricedId = await seedPricedType(dbUrl, { ...PRICED, productSlug });
  const pricesBefore = await priceCountByType(dbUrl, pricedId);

  await page.goto(`${base}/admin/price-types/new`, {
    waitUntil: 'networkidle',
  });
  await page.locator('#pt-name').fill(NEW_TYPE.name);
  await page.locator('#pt-code').fill(NEW_TYPE.code);
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.waitForURL(`${base}/admin/price-types`, { timeout: 15_000 });
  const created = await priceTypeCount(dbUrl, NEW_TYPE.code);

  await confirmDelete(page, NEW_TYPE.name);
  await page
    .getByRole('row', { name: new RegExp(NEW_TYPE.name) })
    .waitFor({ state: 'detached', timeout: 10_000 });
  const left = await priceTypeCount(dbUrl, NEW_TYPE.code);
  check(
    'адмін: тип ціни створено й видалено',
    created === 1 && left === 0,
    `створено ${created}, лишилось ${left}`,
  );

  check(
    'адмін: видалення дефолтного retail — кнопка disabled',
    await deleteButtonOf(page, 'Роздрібна').isDisabled(),
    '',
  );

  await confirmDelete(page, PRICED.name);
  const conflictToast = await waitText(page, 'Запис використовується');
  const typeLeft = await priceTypeCount(dbUrl, PRICED.code);
  const pricesAfter = await priceCountByType(dbUrl, pricedId);
  check(
    'адмін: тип із цінами → тост conflictReference, ціни на місці',
    conflictToast &&
      typeLeft === 1 &&
      pricesBefore > 0 &&
      pricesAfter === pricesBefore,
    `тост=${conflictToast}, тип=${typeLeft}, ціни ${pricesBefore}→${pricesAfter}`,
  );
}

/** Прибирання: видалити розділ → рядка немає, призначення зникло каскадом. */
export async function removeSectionPart({ page, base, dbUrl, check, section }) {
  await page.goto(`${base}/admin/sections`, { waitUntil: 'networkidle' });
  await confirmDelete(page, section.name);
  await page
    .getByRole('row', { name: new RegExp(section.name) })
    .waitFor({ state: 'detached', timeout: 10_000 });
  const rows = await sectionsBySlug(dbUrl, section.slug);
  const assignments = await assignmentsOfSection(dbUrl, section.id);
  check(
    'адмін: розділ видалено, призначення зникло каскадом',
    rows.length === 0 && assignments.length === 0,
    `розділів ${rows.length}, призначень ${assignments.length}`,
  );
}
