/**
 * SQL кроку «система» К3-Е6б (`./admin-system.mjs`) — окремим модулем за
 * каноном 150 рядків: читання фактів (профіль, склад, тема, плагін, логотипи)
 * і знімок/відновлення стану.
 *
 * 🔴 Відновлення SQL-ом ОМИНАЄ кеш процесу `simplycms/site` (Е6б-9): вітрина
 * того самого `server.mjs` до 5 хв бачила б старі профіль і тему. Тому крок
 * іде ОСТАННІМ у прогоні — наступний прогін піднімає новий сервер.
 */
import { sql } from './sql.mjs';

const PROFILE_KEY = 'store_profile';
const STOCK_KEY = 'stock_management';
export const FAQ_PLUGIN = 'faq';

/** `value` рядка `system_settings` за ключем (`null` — рядка немає). */
async function settingValue(url, key) {
  const [row] = await sql(
    url,
    'select value from public.system_settings where key = $1',
    [key],
  );
  return row?.value ?? null;
}

/** Профіль магазину як він лежить у БД (jsonb, логотип — референс). */
export const profileValue = (url) => settingValue(url, PROFILE_KEY);

/** Прапорець «списувати залишок» (`null` — рядка немає). */
export async function decreaseOnOrder(url) {
  const value = await settingValue(url, STOCK_KEY);
  return value ? value.decrease_on_order === true : null;
}

/** Назва активної теми (`null` — активної немає). */
export async function activeTheme(url) {
  const [row] = await sql(
    url,
    'select name from public.themes where is_active order by name',
  );
  return row?.name ?? null;
}

/** `display_name` теми — ним адмінка підписує картку (`aria-label`). */
export async function themeDisplayName(url, name) {
  const [row] = await sql(
    url,
    'select display_name from public.themes where name = $1',
    [name],
  );
  return row?.display_name ?? null;
}

/** Рядок плагіна: підпис картки й активність. */
export async function pluginRow(url, name) {
  const [row] = await sql(
    url,
    'select display_name, is_active from public.plugins where name = $1',
    [name],
  );
  return row ?? null;
}

/** Референси рядків `media` логотипа магазину. */
export async function storeLogoRefs(url) {
  const rows = await sql(
    url,
    `select storage_key from public.media
      where entity_type = 'store_logo' order by storage_key`,
  );
  return rows.map((r) => r.storage_key);
}

/** Знімок ДО кроку — те, що `restoreSystem` поверне в `finally`. */
export async function snapshotSystem(url) {
  return {
    profile: await profileValue(url),
    stock: await settingValue(url, STOCK_KEY),
    theme: await activeTheme(url),
    faqActive: (await pluginRow(url, FAQ_PLUGIN))?.is_active ?? null,
    logoRefs: await storeLogoRefs(url),
  };
}

/**
 * Повертає знімок і стирає рядки `media` логотипа, створені кроком. Файли в
 * `MEDIA_ROOT` стенда лишаються сиротами без рядка (sweep — К4).
 * Тема: спершу зняти активну, потім поставити — частковий унікальний індекс
 * `themes_active_idx` не deferrable (Е6б-15).
 */
export async function restoreSystem(url, snap) {
  for (const [key, value] of [
    [PROFILE_KEY, snap.profile],
    [STOCK_KEY, snap.stock],
  ]) {
    if (value === null) continue;
    await sql(
      url,
      'update public.system_settings set value = $2 where key = $1',
      [key, JSON.stringify(value)],
    );
  }
  if (snap.theme) {
    await sql(
      url,
      'update public.themes set is_active = false where is_active and name <> $1',
      [snap.theme],
    );
    await sql(
      url,
      'update public.themes set is_active = true where name = $1',
      [snap.theme],
    );
  }
  if (snap.faqActive !== null)
    await sql(url, 'update public.plugins set is_active = $2 where name = $1', [
      FAQ_PLUGIN,
      snap.faqActive,
    ]);
  const removed = await sql(
    url,
    `delete from public.media
      where entity_type = 'store_logo' and storage_key <> all($1)
      returning storage_key`,
    [snap.logoRefs],
  );
  return removed.map((r) => r.storage_key);
}
