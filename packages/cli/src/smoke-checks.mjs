// Чисті рішення `simplycms smoke`: що вважати успіхом для кожної перевірки.
// Без мережі: smoke.mjs знімає знімок відповіді (`{ status, ... }`), тут його оцінюють.

/** Розмір тіла для перевірки стелі: над 1 МіБ за замовчуванням, під multipart-стелю. */
export const OVERSIZED_BODY_BYTES = 3 * 1024 * 1024;

/** @typedef {{ ok: boolean, detail: string }} Verdict */

const verdict = (ok, detail) => ({ ok, detail });

/** @param {{ status: number, json: { status?: unknown, build?: unknown } | null }} res */
export function checkHealth({ status, json }) {
  if (status !== 200) return verdict(false, `HTTP ${status}`);
  if (json?.status !== 'healthy')
    return verdict(false, `status=${String(json?.status)}`);
  if (typeof json.build !== 'string' || json.build === '')
    return verdict(
      false,
      'build порожній: збірка не знає свого ідентифікатора',
    );
  return verdict(true, `збірка ${json.build}`);
}

/** Сторінка вітрини віддається: 200. */
export function checkPage({ status }) {
  return verdict(status === 200, `HTTP ${status}`);
}

/** Сторінка входу: guard `/admin` у `src/start.ts` шле неавторизованого на `/auth`. */
const LOGIN_PATH = '/auth';

/**
 * Редирект `/admin` має вести на вхід цього ж магазину. Будь-який інший 3xx
 * (`308 → /admin/`, чужий хост) означає зламаний guard або проксі.
 * @param {{ status: number, location: string | null, base: URL }} res
 */
export function checkAdminRedirect({ status, location, base }) {
  if (![301, 302, 303, 307, 308].includes(status))
    return verdict(false, `HTTP ${status}, очікувався редирект на вхід`);
  if (!location) return verdict(false, `HTTP ${status} без Location`);
  let target;
  try {
    target = new URL(location, base);
  } catch {
    return verdict(false, `HTTP ${status}, Location не адреса`);
  }
  if (target.origin !== base.origin)
    return verdict(false, `редирект на інший хост (${target.origin})`);
  if (target.pathname !== LOGIN_PATH)
    return verdict(
      false,
      `редирект на ${target.pathname}, очікувався ${LOGIN_PATH}`,
    );
  return verdict(true, `HTTP ${status} → ${target.pathname}`);
}

/** @param {{ status: number, text: string }} res */
export function checkRobots({ status, text }) {
  if (status !== 200) return verdict(false, `HTTP ${status}`);
  return /user-agent/i.test(text)
    ? verdict(true, 'HTTP 200')
    : verdict(false, 'немає директиви User-agent');
}

/** Перший `/assets/*.js` у HTML: вхідний бандл (інлайн-імпорт чи `src`). */
export function findEntryScript(html) {
  return /\/assets\/[\w.-]+\.js/.exec(html)?.[0] ?? null;
}

/** @param {{ status: number, encoding: string | null }} res */
export function checkBrotli({ status, encoding }) {
  if (status !== 200) return verdict(false, `HTTP ${status}`);
  return encoding === 'br'
    ? verdict(true, 'content-encoding: br')
    : verdict(false, `content-encoding: ${encoding ?? 'немає'}, очікувався br`);
}

/** 413 — відмова раннера; 502 означає, що обрив зʼєднання дійшов до проксі. */
export function checkBodyLimit({ status }) {
  return status === 413
    ? verdict(true, 'HTTP 413')
    : verdict(
        false,
        `HTTP ${status}, очікувалось 413 (502 — обрив зʼєднання за стелею)`,
      );
}
