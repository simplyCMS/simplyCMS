/**
 * Банери кроку контенту К3-Е6д (`./admin-content.mjs`): створення з PNG і
 * кнопкою → головна вітрини; заміна картинки (Е6д-1 + Е6д-14: старий рядок
 * `media` стерто в транзакції, файл — після COMMIT); видалення через діалог.
 *
 * 🔴 Головну малює `HeroBanner` активної теми `default`: вона показує ЛИШЕ
 * фото першого банера з картинкою (`alt` = заголовок), а тексти й кнопки
 * банера не рендерить (рішення теми, не ядра). Тож вітрина доводить
 * «заголовок + картинка з `/media`», а кнопку `/catalog` — SQL. Демо-банери
 * на час кроку вимикаються, щоб першим був банер кроку; `finally` повертає.
 */
import { PNG } from './avatar.mjs';
import { bannerByTitle, mediaKeysOf, poll } from './admin-content-sql.mjs';
import { sql } from './sql.mjs';

/** Основне зображення — ПЕРШИЙ із трьох `ImageUpload` картки. */
const MAIN_INPUT = 'form input[type="file"]';
const MAIN_THUMB = 'form div.group';

async function uploadMain(page, name) {
  await page
    .locator(MAIN_INPUT)
    .first()
    .setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
  await page
    .locator(`${MAIN_THUMB} img[src^="/media/"]`)
    .first()
    .waitFor({ timeout: 10_000 });
}

/** Hero головної: `<img>` із заголовком банера в `alt` і його `src`. */
async function homeShows(page, base, fx) {
  await page.goto(base, { waitUntil: 'networkidle' });
  const img = page.locator(`img[alt="${fx.bannerTitle}"]`).first();
  return (await img.count()) ? await img.getAttribute('src') : null;
}

export async function bannersPart({ page, guest, base, dbUrl, check, fx, st }) {
  st.demoBanners = (
    await sql(
      dbUrl,
      'update public.banners set is_active = false where is_active returning id',
    )
  ).map((r) => r.id);
  // 1. Створення: картка `new`, PNG, кнопка `/catalog`.
  await page.goto(`${base}/admin/banners/new`, { waitUntil: 'networkidle' });
  await page.locator('#banner-title').fill(fx.bannerTitle);
  await uploadMain(page, 'banner-1.png');
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await page.locator('#btn-text-0').fill(fx.bannerButton);
  await page.locator('#btn-url-0').fill('/catalog');
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.waitForURL(`${base}/admin/banners`, { timeout: 15_000 });
  const created = await poll(() => bannerByTitle(dbUrl, fx.bannerTitle));
  st.bannerId = created?.id ?? null;
  const firstKeys = created
    ? await mediaKeysOf(dbUrl, 'banner', created.id)
    : [];
  st.mediaKeys.push(...firstKeys);
  check(
    'контент: банер створено — home, картинка = рядок media банера, кнопка /catalog',
    created?.placement === 'home' &&
      firstKeys.length === 1 &&
      firstKeys[0] === created.image_url &&
      created.buttons?.[0]?.url === '/catalog',
    JSON.stringify({ ...created, media: firstKeys }),
  );
  const shown = await homeShows(guest, base, fx);
  check(
    'контент: головна вітрини показує банер — заголовок і картинка з /media',
    shown !== null && shown === `/media/${created?.image_url}`,
    `img[alt=заголовок] src ${shown}`,
  );

  // 2. Заміна картинки: прибрати стару (без стирання пікером) → нова → «Зберегти».
  await page.goto(`${base}/admin/banners/${st.bannerId}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: 'Зберегти' }).waitFor();
  const thumb = page.locator(MAIN_THUMB).first();
  await thumb.hover();
  await thumb.locator('button').last().click();
  await uploadMain(page, 'banner-2.png');
  await page.getByRole('button', { name: 'Зберегти' }).click();
  await page.waitForURL(`${base}/admin/banners`, { timeout: 15_000 });
  const old = created?.image_url;
  const replaced = await poll(
    () => bannerByTitle(dbUrl, fx.bannerTitle),
    (v) => v !== null && v.image_url !== old,
  );
  const keys = st.bannerId
    ? await mediaKeysOf(dbUrl, 'banner', st.bannerId)
    : [];
  st.mediaKeys.push(...keys);
  const oldFile = old
    ? (await page.request.get(`${base}/media/${old}`)).status()
    : 0;
  check(
    'контент: заміна картинки — старого рядка media немає, новий є, старий файл 404',
    replaced?.image_url !== old &&
      keys.length === 1 &&
      keys[0] === replaced?.image_url &&
      oldFile === 404,
    `було ${old}, стало ${replaced?.image_url}, рядки ${JSON.stringify(keys)}, старий GET ${oldFile}`,
  );
  const shownNew = await homeShows(guest, base, fx);
  check(
    'контент: головна після заміни показує нову картинку банера',
    shownNew === `/media/${replaced?.image_url}`,
    `src ${shownNew}`,
  );

  // 3. Видалення через діалог списку.
  await page.goto(`${base}/admin/banners`, { waitUntil: 'networkidle' });
  await page
    .getByRole('row')
    .filter({ hasText: fx.bannerTitle })
    .getByRole('button', { name: 'Видалити' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити' })
    .click();
  const gone = await poll(
    () => bannerByTitle(dbUrl, fx.bannerTitle),
    (v) => v === null,
  );
  const left = st.bannerId
    ? await mediaKeysOf(dbUrl, 'banner', st.bannerId)
    : [];
  const after = await homeShows(guest, base, fx);
  check(
    'контент: банер видалено — немає ні в БД (з рядками media), ні на вітрині',
    gone === null && left.length === 0 && after === null,
    `рядок ${gone ? 'лишився' : 'немає'}, media ${JSON.stringify(left)}, вітрина ${after ?? 'без банера'}`,
  );
  if (gone === null) st.bannerId = null;
}
