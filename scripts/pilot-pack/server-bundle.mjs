/**
 * Чиста логіка Gate SB — серверний бандл скретч-магазину й що в нього вклеєно.
 *
 * Окремо від `gate-sb.mjs` (читання файлу), щоб юніт-тест `tests/pilot-server-bundle.test.ts`
 * ганяв її на синтетичних даних і мутував без повної збірки.
 *
 * 🔴 Чому гейт існує. Vite у build резолвить external від КОРЕНЯ магазину: залежність, якої
 * там немає (транзитивна під pnpm strict), вклеюється в серверний бандл. Для більшості
 * пакетів це нешкідливо, але вклеєний CJS-пакет із `exports`, що має ESM-вхід, ламається
 * через дефект import-protection плагіна Start (`UPSTREAM:START-IP-1`): `require()` усередині
 * бандла резолвиться за умовою `import`. Так `pg` → `pg-pool` давав `Class extends value
 * #<Object>` на старті свіжого магазину (0.7.0–0.13.0, Task 11 К3-Е7).
 */

/** Драйвер БД ніколи не вклеюється: його постачає магазин (peer ядра), а не бандл. */
export const FORBIDDEN_BUNDLED = /^(pg|pg-.+|pgpass|postgres-.+)$/;

/**
 * Імʼя npm-пакета з module id (абсолютний шлях, можливо з `\0`-префіксом і query).
 * Береться ОСТАННІЙ `node_modules/`: у pnpm шлях — `.pnpm/<id>/node_modules/<pkg>/…`.
 */
export function packageOfModule(id) {
  const marker = 'node_modules/';
  const at = id.lastIndexOf(marker);
  if (at < 0) return null;
  const [first, second] = id.slice(at + marker.length).split('/');
  if (!first || first.startsWith('.')) return null;
  return first.startsWith('@') ? `${first}/${second}` : first;
}

/** Множина npm-пакетів, чиї модулі потрапили в чанки (`bundle-stats.ssr.json`). */
export function bundledPackages(stats) {
  const found = new Set();
  for (const chunk of Object.values(stats)) {
    for (const id of chunk.modules ?? []) {
      const name = packageOfModule(id);
      if (name) found.add(name);
    }
  }
  return [...found].sort();
}

/**
 * @param {Record<string, { modules: string[] }>} stats
 * @param {Record<string, string>} allowlist пакет → причина, чому йому можна бути вклеєним
 * @returns {{ ok: boolean; details: string[]; bundled: string[] }}
 */
export function checkServerBundle(stats, allowlist) {
  const bundled = bundledPackages(stats);
  const details = [`вклеєно пакетів із node_modules: ${bundled.length}`];
  let ok = true;

  const forbidden = bundled.filter((name) => FORBIDDEN_BUNDLED.test(name));
  details.push(
    forbidden.length
      ? `FAIL драйвер БД вклеєно в серверний бандл: ${forbidden.join(', ')} (мусить бути прямою залежністю магазину)`
      : 'OK   драйвер БД (pg, pg-*) не вклеєно',
  );
  if (forbidden.length) ok = false;

  const unknown = bundled.filter(
    (name) => !FORBIDDEN_BUNDLED.test(name) && !(name in allowlist),
  );
  details.push(
    unknown.length
      ? `FAIL вклеєно пакети без причини в allowlist: ${unknown.join(', ')} — зроби їх external (пряма залежність/peer) або додай обґрунтований запис`
      : 'OK   кожен вклеєний пакет має причину в allowlist',
  );
  if (unknown.length) ok = false;

  // Allowlist лише скорочується: запис, якого в бандлі вже немає, — гниль.
  const stale = Object.keys(allowlist).filter(
    (name) => !bundled.includes(name),
  );
  details.push(
    stale.length
      ? `FAIL allowlist містить пакети, яких у бандлі немає: ${stale.join(', ')} — прибери записи`
      : 'OK   allowlist без застарілих записів',
  );
  if (stale.length) ok = false;

  return { ok, details, bundled };
}

/**
 * Нормалізований id модуля: без `\0`-префікса й query (`?v=…`), які Vite додає до
 * віртуальних і перебудованих модулів, — інакше одна копія виглядала б двома.
 */
const normalizeModuleId = (id) => id.replace(/^\0/, '').replace(/\?.*$/, '');

/** Файл контексту запиту ядра: `dist/site/request-context.js` (чи `src/…` у dev-збірці). */
const REQUEST_CONTEXT_MODULE = /[\\/]site[\\/]request-context\.[cm]?[jt]s$/;

/**
 * Д6: `AsyncLocalStorage` контексту запиту має бути ОДИН на зібраний сервер.
 * Друга копія модуля (інший id тієї ж логіки: симлінк і realpath, `src` і `dist`,
 * дубль у чанку serverFn) дала б host-обгортці одне сховище, а `readGenerations`
 * у лоадерах — інше: `getRequestContext()` там порожній, і кожен `get` кешу
 * відкриває окрему транзакцію `select`. Жоден інший гейт цього не бачить.
 *
 * Рахуються входження нормалізованого id у модулі всіх чанків: рівно одне.
 * Нуль — модуль не вклеєно (ядро пішло external, а host тоді тримає окремий
 * екземпляр від чанків, що вклеїли його самі), понад одне — дубль.
 *
 * @param {Record<string, { modules: string[] }>} stats
 * @returns {{ ok: boolean; details: string[]; ids: string[] }}
 */
export function checkRequestContextSingle(stats) {
  const ids = [];
  for (const chunk of Object.values(stats)) {
    for (const id of chunk.modules ?? []) {
      const normalized = normalizeModuleId(id);
      if (REQUEST_CONTEXT_MODULE.test(normalized)) ids.push(normalized);
    }
  }
  const ok = ids.length === 1;
  const details = [
    ok
      ? 'OK   модуль site/request-context вклеєно рівно один раз'
      : `FAIL модуль site/request-context зустрівся ${ids.length} раз(и) у серверних чанках (очікується рівно 1): ${ids.join(', ') || '—'}`,
  ];
  return { ok, details, ids };
}
