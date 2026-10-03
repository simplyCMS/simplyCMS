/**
 * Крок К3-Е4 — ЄДИНИЙ живий доказ довідників каталогу адмінки: власник
 * створює розділ (із зображенням через порт сховища), властивість з опцією,
 * призначає її розділу, працює з типами цін — і вітрина все це бачить.
 * Дубль slug і видалення типу ціни з цінами доводять тости i18n через
 * СПРАВЖНЮ межу serverFn (Review Focus 1/4 — харнес її не перетинає).
 *
 * Отримує вже залогінений context (`./owner-session.mjs`), відкриває ВЛАСНУ
 * сторінку з власним лічильником `pageerror` і контекст НЕ закриває.
 * Властивість/опція — `./admin-dictionaries-properties.mjs`, типи цін і
 * прибирання — `./admin-dictionaries-price-types.mjs` (канон 150 рядків).
 */
import { PNG } from './avatar.mjs';
import {
  assignmentsOfSection,
  sectionsBySlug,
} from './admin-dictionaries-sql.mjs';
import {
  PROP,
  createPropertyWithOption,
  verifyPropertyPage,
} from './admin-dictionaries-properties.mjs';
import {
  runPriceTypesPart,
  removeSectionPart,
} from './admin-dictionaries-price-types.mjs';
import { waitText } from './selectors.mjs';

const SECTION = { slug: 'live-dict-section', name: 'Живий розділ Е4' };

/** Форма нового розділу: назва, slug, (опційно) зображення → «Створити». */
async function submitNewSection(page, base, withImage) {
  await page.goto(`${base}/admin/sections/new`, { waitUntil: 'networkidle' });
  await page.locator('#section-name').fill(SECTION.name);
  await page.locator('#section-slug').fill(SECTION.slug);
  if (withImage) {
    await page.setInputFiles('input[type="file"]', {
      name: 'section.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page.locator('img[src^="/media/"]').first().waitFor({
      timeout: 10_000,
    });
  }
  await page.getByRole('button', { name: 'Створити' }).click();
}

export async function runAdminDictionariesStep({
  context,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  // Свій лічильник: інша сторінка, ніж у кроку каталогу Е3 (Е3-20).
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    // 1. Розділ із зображенням → БД → вітрина /catalog.
    await submitNewSection(page, base, true);
    await page.waitForURL(`${base}/admin/sections`, { timeout: 15_000 });
    const [section] = await sectionsBySlug(dbUrl, SECTION.slug);
    check(
      'адмін: розділ у БД, активний, image_url — референс сховища',
      section?.is_active === true &&
        /^[^/]/.test(section.image_url ?? '') &&
        !/^https?:/.test(section.image_url),
      JSON.stringify(section ?? null),
    );
    const catalog = await page.goto(`${base}/catalog`);
    const catalogText = (await page.locator('main').textContent()) ?? '';
    check(
      'вітрина: /catalog показує новий розділ',
      catalog?.status() === 200 && catalogText.includes(SECTION.name),
      String(catalog?.status()),
    );

    // 2. Дубль slug → тост admin.errors.slugTaken, другого рядка немає.
    await submitNewSection(page, base, false);
    const dupToast = await waitText(page, 'Такий URL (slug) уже зайнятий');
    const sections = await sectionsBySlug(dbUrl, SECTION.slug);
    check(
      'адмін: дубль slug розділу → тост i18n, рядок один',
      dupToast && sections.length === 1,
      `тост=${dupToast}, рядків=${sections.length}`,
    );

    // 3. Властивість select + hasPage + isFilterable → картка → опція.
    const prop = await createPropertyWithOption({ page, base, dbUrl, check });

    // 4. Призначення «для товарів»; у діалозі «для модифікацій» її немає.
    await page.goto(`${base}/admin/sections/${section?.id}`, {
      waitUntil: 'networkidle',
    });
    await page
      .getByRole('button', { name: 'Додати властивість для товарів' })
      .click();
    await page.locator('#assignment-property').click();
    await page.getByRole('option', { name: new RegExp(PROP.name) }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Додати' })
      .click();
    await waitText(page, 'Властивість додано');
    const assigned = await assignmentsOfSection(dbUrl, section?.id);
    check(
      'адмін: призначення applies_to = product',
      assigned.length === 1 &&
        assigned[0].property_id === prop?.id &&
        assigned[0].applies_to === 'product',
      JSON.stringify(assigned),
    );
    await page
      .getByRole('button', { name: 'Додати властивість для модифікацій' })
      .click();
    await page.locator('#assignment-property').click();
    // Список відкрився (демо-властивості розділу не призначені) — інакше
    // нуль нижче був би нулем «ще не відрендерилось».
    await page.getByRole('listbox').waitFor({ timeout: 10_000 });
    const offered = await page
      .getByRole('option', { name: new RegExp(PROP.name) })
      .count();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    check(
      'адмін: у діалозі «для модифікацій» призначеної властивості немає',
      offered === 0,
      `запропоновано ${offered}`,
    );

    // 5. Вітрина: сторінка властивості з опцією.
    await verifyPropertyPage({ page, base, check });

    // 6–7. Типи цін; прибирання розділу з каскадом призначення.
    await runPriceTypesPart({ page, base, dbUrl, check });
    const toRemove = { ...SECTION, id: section?.id };
    await removeSectionPart({ page, base, dbUrl, check, section: toRemove });

    // 8. Нуль pageerror кроку довідників.
    check(
      'адмін pageerror за весь крок довідників',
      errors.length === 0,
      errors.length === 0 ? '0' : errors.join(' | '),
    );
  } finally {
    await page.close();
  }
}
