import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Негативний контроль зони серверного env (`SERVER_ENV_FILES`, контракт §7).
 *
 * 🔴 Зелений `pnpm lint` не доводить, що зона ловить `import.meta.env`: правило,
 * що мовчки відвалилось (або файл, що випав зі списку), теж дає зелений лінт.
 * Тут ESLint отримує СИНТЕТИЧНЕ порушення з filePath усередині й поза зоною.
 * Список файлів — рукописний, а не імпорт із конфігу: тест не переказує
 * конфіг, а незалежно фіксує, які модулі МАЮТЬ бути в зоні.
 */

const SERVER_ENV_PATHS = [
  'packages/simplycms/src/storefront-routes/seo/robots.ts',
  'packages/simplycms/src/storefront-routes/seo/sitemap.ts',
  'packages/simplycms/src/storefront-routes/server/root.ts',
  'packages/simplycms/routes/storefront/api/health.tsx',
  'src/start.ts',
];

const CLEAN_CONTROL =
  'packages/simplycms/src/storefront-routes/components/X.tsx';
const VIOLATION = 'export const x = import.meta.env.FOO;\n';

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO });
});

async function envMessages(filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(VIOLATION, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  // Файл, зʼїдений ignores, дав би 0 повідомлень і хибно-зелений тест.
  return (result?.messages ?? [])
    .filter(
      (m) =>
        m.ruleId === 'no-restricted-syntax' &&
        m.message.includes('process.env'),
    )
    .map((m) => m.message);
}

describe('зона серверного env: import.meta.env заборонено', () => {
  it.each(SERVER_ENV_PATHS)('ловить import.meta.env у %s', async (path) => {
    expect(await envMessages(path)).toHaveLength(1);
  });

  it('клієнтський контур (поза зоною) не отримує повідомлення про process.env', async () => {
    expect(await envMessages(CLEAN_CONTROL)).toEqual([]);
  });
});
