/**
 * Сесія власника для кроків адмінки живого прогону (К3-Е3 → винесено в Е4).
 *
 * Запрошення (`owner-invite.mts`) → пароль → `/admin` в ОКРЕМОМУ browser
 * context: сесія покупця воронки не змішується з адмінською. Контекст
 * повертається НЕЗАКРИТИМ — ним користуються кілька кроків поспіль
 * (каталог Е3, довідники Е4), а закриває його оркестрація (`live-smoke.mjs`)
 * у `finally`. Кожен крок відкриває власну сторінку й рахує свій `pageerror`.
 *
 * Сторінка входу тут і закривається, а її `pageerror` повертається як
 * `loginErrors`: до Е4 вони потрапляли в лічильник кроку каталогу (вхід був
 * його частиною), тож оркестрація зараховує їх у рядок входу — покриття не
 * звужується.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const PASSWORD = 'live-smoke-owner-2026';

/**
 * @param {{browser: import('@playwright/test').Browser, base: string,
 *   storeEnv: Record<string, string>}} args
 * @returns {Promise<{context: import('@playwright/test').BrowserContext,
 *   email: string, loginErrors: string[]}>}
 */
export async function openOwnerSession({ browser, base, storeEnv }) {
  const email = `owner-${randomUUID().slice(0, 8)}@example.test`;
  const { url } = JSON.parse(
    execFileSync(
      'pnpm',
      [
        'exec',
        'tsx',
        join(import.meta.dirname, 'owner-invite.mts'),
        email,
        base,
      ],
      { env: { ...process.env, ...storeEnv }, encoding: 'utf8' },
    ),
  );

  const context = await browser.newContext();
  const loginErrors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => loginErrors.push(String(e)));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Повторіть пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Зберегти і продовжити' }).click();
    await page.waitForURL(`${base}/admin`, { timeout: 15_000 });
    await page.close();
  } catch (e) {
    await context.close();
    throw e;
  }
  return { context, email, loginErrors };
}
