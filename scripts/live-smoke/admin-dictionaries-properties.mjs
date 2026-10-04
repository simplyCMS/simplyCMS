/**
 * Властивість і опція кроку довідників (К3-Е4): створення в адмінці й
 * сторінка властивості на вітрині. Виніс із `./admin-dictionaries.mjs` —
 * канон 150 рядків.
 */
import { optionBySlug, propertyBySlug } from './admin-dictionaries-sql.mjs';
import { waitText } from './selectors.mjs';

export const PROP = { slug: 'live-dict-prop', name: 'Жива властивість Е4' };
const OPT = { slug: 'live-dict-opt', name: 'Жива опція Е4' };

/**
 * `/admin/properties` → діалог: тип `select`, `hasPage`, `isFilterable` →
 * картка (контролу типу немає, Е4-5) → опція. Повертає рядок властивості.
 */
export async function createPropertyWithOption({ page, base, dbUrl, check }) {
  await page.goto(`${base}/admin/properties`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Додати властивість' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#property-new-name').fill(PROP.name);
  await dialog.locator('#property-new-slug').fill(PROP.slug);
  await dialog.locator('#property-new-type').click();
  await page.getByRole('option', { name: 'Вибір (один)' }).click();
  await dialog.locator('#property-new-hasPage').click();
  await dialog.locator('#property-new-isFilterable').click();
  await dialog.getByRole('button', { name: 'Створити' }).click();
  await waitText(page, 'Властивість створено');
  const prop = await propertyBySlug(dbUrl, PROP.slug);
  check(
    'адмін: властивість select, hasPage, isFilterable, глобальна',
    prop?.property_type === 'select' &&
      prop.has_page &&
      prop.is_filterable &&
      prop.section_id === null,
    JSON.stringify(prop),
  );

  await page.goto(`${base}/admin/properties/${prop?.id}`, {
    waitUntil: 'networkidle',
  });
  const addOption = page.getByRole('button', { name: 'Додати опцію' });
  await addOption.waitFor({ timeout: 10_000 });
  check(
    'адмін: картка властивості без контролу типу (Е4-5)',
    (await page.locator('#property-type').count()) === 0 &&
      (await page.getByText('Тип властивості').count()) > 0,
    '#property-type відсутній, тип — текстом',
  );
  await addOption.click();
  await page.locator('#option-name').fill(OPT.name);
  await page.locator('#option-slug').fill(OPT.slug);
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.waitForURL(`${base}/admin/properties/${prop?.id}`, {
    timeout: 15_000,
  });
  const opt = await optionBySlug(dbUrl, OPT.slug);
  check(
    'адмін: опція з property_id властивості',
    opt !== null && opt.property_id === prop?.id,
    JSON.stringify(opt),
  );
  return prop;
}

/** Вітрина: `/properties/<slug>` — 200 і назва опції в тексті сторінки. */
export async function verifyPropertyPage({ page, base, check }) {
  const res = await page.goto(`${base}/properties/${PROP.slug}`);
  const text = (await page.locator('main').textContent()) ?? '';
  check(
    `вітрина: /properties/${PROP.slug} 200 з назвою опції`,
    res?.status() === 200 && text.includes(OPT.name),
    String(res?.status()),
  );
}
