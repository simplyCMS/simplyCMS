import { buildRobotsTxt as buildRobots } from '@simplycms/storefront/seo';

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

/** Генерує robots.txt (host-glue: VITE_SITE_URL). */
export function buildRobotsTxt(): Promise<string> {
  return buildRobots(BASE_URL);
}
