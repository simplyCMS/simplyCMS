/** Генерує robots.txt. baseUrl інжектується host'ом. */
export async function buildRobotsTxt(baseUrl: string): Promise<string> {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    // `/api/` уже накриває й ендпойнти Better Auth (`/api/auth/*`), тож
    // окремого рядка під них немає. Рядок `/auth/callback` знято разом із
    // OAuth-роутом GoTrue (К1′б).
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ];

  return lines.join('\n');
}
