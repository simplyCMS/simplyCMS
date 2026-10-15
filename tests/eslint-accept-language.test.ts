import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Негативний контроль І30: у зоні вітрини не читається `Accept-Language`.
 *
 * 🔴 Зелений `pnpm lint` не доводить, що селектор живий: правило, що мовчки
 * відвалилось або файл, який випав із зони, теж дає зелений лінт. Тому ESLint
 * отримує СИНТЕТИЧНЕ порушення з filePath усередині зони (кожна підтека, де
 * живе розбір мови) і поза нею, а справжній `resolve.ts` лінтиться своїм
 * реальним текстом — мутація «функція читає заголовок» валить саме цей тест.
 */

const ZONE_PATHS = [
  'packages/simplycms/src/storefront-routes/locale/resolve.ts',
  'packages/simplycms/src/storefront-routes/seo/normalize.ts',
  'packages/simplycms/src/storefront-routes/pages/Home.tsx',
  'packages/simplycms/src/storefront/loaders/products.ts',
  'packages/simplycms/routes/storefront/api/x.ts',
  'src/server.ts',
];
const OUTSIDE = 'packages/simplycms/src/admin-server/impl/x.ts';

const VIOLATIONS = [
  "export const a = (r: Request) => r.headers.get('Accept-Language');\n",
  "export const b = (h: Record<string, string>) => h['accept-language'];\n",
  'export const c = (r: Request) => r.headers.get(`Accept-Language`);\n',
];

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: REPO });
});

async function acceptLanguageMessages(
  filePath: string,
  text: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(text, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  return (result?.messages ?? [])
    .filter(
      (m) =>
        m.ruleId === 'no-restricted-syntax' &&
        m.message.includes('Accept-Language'),
    )
    .map((m) => m.message);
}

describe('І30: Accept-Language заборонено в зоні вітрини', () => {
  for (const path of ZONE_PATHS) {
    for (const violation of VIOLATIONS) {
      it(`ловить ${JSON.stringify(violation.slice(0, 40))}… у ${path}`, async () => {
        expect(await acceptLanguageMessages(path, violation)).toHaveLength(1);
      });
    }
  }

  it('поза зоною правило мовчить (контроль скоупінгу)', async () => {
    expect(await acceptLanguageMessages(OUTSIDE, VIOLATIONS[0]!)).toEqual([]);
  });

  it('справжній resolveRequestLocale не читає заголовка', async () => {
    const path = 'packages/simplycms/src/storefront-routes/locale/resolve.ts';
    const text = readFileSync(join(REPO, path), 'utf8');
    expect(await acceptLanguageMessages(path, text)).toEqual([]);
  });
});
