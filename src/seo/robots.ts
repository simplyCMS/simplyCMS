const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

/** Генерує robots.txt */
export async function buildRobotsTxt(): Promise<string> {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /auth/callback',
    '',
    `Sitemap: ${BASE_URL}/sitemap.xml`,
  ];

  return lines.join('\n');
}
