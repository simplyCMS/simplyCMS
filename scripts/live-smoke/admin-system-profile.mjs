/**
 * Підкроки 1–2 кроку «система» К3-Е6б (`./admin-system.mjs`): профіль
 * магазину й заміна логотипа. Окремим модулем за каноном 150 рядків.
 *
 * 🔴 Перед мутацією покупець ПРОГРІВАЄ кеш профілю (`storeProfileCache`)
 * запитом головної: лише тоді «новий запит бачить нове» доводить скидання
 * кешу операцією, а не холодний чи протухлий кеш.
 */
import { PNG } from './avatar.mjs';
import { waitText } from './selectors.mjs';
import { pollUntil } from './admin-shipping-sql.mjs';
import * as q from './admin-system-sql.mjs';

const LOGO_INPUT = 'input[type="file"]';

/** Завантажує логотип і чекає прев'ю в сітці форми. */
async function uploadLogo(page, name) {
  await page.setInputFiles(LOGO_INPUT, {
    name,
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByAltText('Image 1').waitFor({ timeout: 10_000 });
}

/** «Зберегти» форми профілю → тост; повертає профіль із БД після запису. */
async function saveProfile(page, dbUrl, pred) {
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await waitText(page, 'Налаштування збережено');
  return pollUntil(() => q.profileValue(dbUrl), pred);
}

/** JSON-LD головної: усі `sameAs` з усіх блоків `application/ld+json`. */
async function homeSameAs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent ?? '{}'))
      .flatMap((d) => (Array.isArray(d.sameAs) ? d.sameAs : [])),
  );
}

/** 1. Назва, телефон, логотип, соцмережа → новий запит вітрини бачить усе. */
export async function profilePart({ page, buyerPage, base, dbUrl, check, fx }) {
  await buyerPage.goto(`${base}/`, { waitUntil: 'networkidle' });
  const warm = await buyerPage.title();
  check(
    'система: кеш профілю прогріто — головна зі старою назвою',
    !warm.includes(fx.name),
    warm,
  );

  await page.goto(`${base}/admin/settings`, { waitUntil: 'networkidle' });
  await page.locator('#sp-name').fill(fx.name);
  // Демо має `homeTitle`; без нього заголовок головної — назва (Е6б-10).
  await page.locator('#sp-home-title').fill('');
  await page.locator('#sp-phone').fill(fx.phone);
  await uploadLogo(page, 'logo-1.png');
  await page.getByRole('button', { name: 'Додати мережу' }).click();
  await page
    .getByLabel('Мережа', { exact: true })
    .last()
    .selectOption('telegram');
  await page.getByLabel('Посилання', { exact: true }).last().fill(fx.telegram);
  const saved = await saveProfile(page, dbUrl, (p) => p?.name === fx.name);

  await buyerPage.goto(`${base}/`, { waitUntil: 'networkidle' });
  const title = await buyerPage.title();
  const logoSrc = await buyerPage
    .locator(`header img[alt="${fx.name}"]`)
    .first()
    .getAttribute('src', { timeout: 10_000 })
    .catch(() => null);
  const phone = await buyerPage
    .locator(`footer a[href="tel:${fx.phone.replace(/[^+\d]/g, '')}"]`)
    .count();
  const sameAs = await homeSameAs(buyerPage);
  check(
    'система: новий запит головної — назва, логотип, телефон, sameAs',
    title.includes(fx.name) &&
      logoSrc === `/media/${saved?.logo}` &&
      phone > 0 &&
      sameAs.includes(fx.telegram),
    `title «${title}», logo ${logoSrc}, tel ${phone}, sameAs ${sameAs.join(' ')}`,
  );

  await buyerPage.goto(`${base}/cart`, { waitUntil: 'networkidle' });
  const cartTitle = `Кошик — ${fx.name}`;
  await buyerPage
    .waitForFunction((t) => document.title === t, cartTitle, {
      timeout: 10_000,
    })
    .catch(() => {});
  const shown = await buyerPage.title();
  check('система: /cart — «Кошик — <назва>»', shown === cartTitle, shown);
  return saved?.logo ?? null;
}

/** 2. Заміна логотипа: у `media` рівно один `store_logo` — новий референс. */
export async function logoReplacePart({ page, base, dbUrl, check, firstRef }) {
  const tile = page.getByAltText('Image 1').locator('xpath=..');
  await tile.hover();
  await tile.getByRole('button').click();
  await uploadLogo(page, 'logo-2.png');
  const saved = await saveProfile(
    page,
    dbUrl,
    (p) => p?.logo && p.logo !== firstRef,
  );
  const refs = await q.storeLogoRefs(dbUrl);
  const old = await page.request.get(`${base}/media/${firstRef}`);
  check(
    'система: заміна логотипа — один store_logo, новий, старий файл 404',
    refs.length === 1 &&
      refs[0] === saved?.logo &&
      refs[0] !== firstRef &&
      old.status() === 404,
    `рядки [${refs.join(', ')}], профіль ${saved?.logo}, старий ${firstRef} → ${old.status()}`,
  );
}
