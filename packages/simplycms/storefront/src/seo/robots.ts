/** Генерує robots.txt. baseUrl інжектується host'ом. */
export async function buildRobotsTxt(baseUrl: string): Promise<string> {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /auth/callback",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ];

  return lines.join("\n");
}
