import {
  loadSitemapData,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { renderSitemapXml } from 'simplycms/storefront/seo';

/**
 * Базовий URL сайту — ЛІНИВО з `process.env` у момент виклику (контракт
 * серверного env, спека CLI v1 §7): модульна константа запеклася б у білд.
 * Дефолт `https://example.com` — чинна задокументована семантика.
 */
function siteUrl(): string {
  return process.env.VITE_SITE_URL || 'https://example.com';
}

/**
 * Генерує sitemap.xml (host-glue: транзакція вітрини + VITE_SITE_URL).
 *
 * 🔴 Актор — `app_user` БЕЗ ідентичності (`withStorefrontDb`): sitemap читає
 * рівно те, що бачить анонім, і робот не має отримати нічого понад це.
 */
export function buildSitemapXml(): Promise<string> {
  const baseUrl = siteUrl();
  return withStorefrontDb(async (db) =>
    renderSitemapXml(await loadSitemapData(db), baseUrl),
  );
}
