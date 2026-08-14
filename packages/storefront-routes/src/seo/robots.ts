import { buildRobotsTxt as buildRobots } from '@simplycms/storefront/seo';

/**
 * Базовий URL сайту — ЛІНИВО з `process.env` у момент виклику (контракт
 * серверного env, спека CLI v1 §7): модульна константа запеклася б у білд.
 * Дефолт `https://example.com` — чинна задокументована семантика.
 */
function siteUrl(): string {
  return process.env.VITE_SITE_URL || 'https://example.com';
}

/** Генерує robots.txt (host-glue: VITE_SITE_URL). */
export function buildRobotsTxt(): Promise<string> {
  return buildRobots(siteUrl());
}
