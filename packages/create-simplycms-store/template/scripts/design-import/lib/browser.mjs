/**
 * Резолюція шляху до бінарника Chromium для запуску Playwright (задача §2.A,
 * план Р2). Проблема: девдепс монорепо — `@playwright/test@1.61.1` —
 * очікує Chromium rev 1228 (`chromium.executablePath()` показує саме цей
 * шлях), а середовище має преінстальованим лише rev 1194
 * (`PLAYWRIGHT_BROWSERS_PATH`), докачування недостатньої ревізії блокує
 * проксі. Живим запуском доведено: 1.61.1 водить chromium-1194 через
 * `launch({ executablePath })` — штатний шлях лише НЕ РЕЗОЛВИТЬСЯ САМ, сам
 * бінарник сумісний. Тому хелпер спершу довіряє штатному шляху (якщо файл
 * реально є на диску — майбутнє середовище з правильною ревізією теж
 * спрацює без змін), інакше сканує `PLAYWRIGHT_BROWSERS_PATH` глобом
 * `chromium-<rev> / chrome-linux<...> / chrome` (обидві розкладки Playwright:
 * `chrome-linux/` до rev ~1200, `chrome-linux64/` у новіших). 🔴 Пробіли
 * навколо `/` тут навмисні: зірочка впритул до слеша закриває цей JSDoc-
 * коментар передчасно (перевірено `node --check`).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROMIUM_DIR_RE = /^chromium-\d+$/;
const CHROME_LINUX_DIR_RE = /^chrome-linux/;

/** Безпечний `readdirSync` — відсутня/недоступна тека не валить сканування. */
function listDirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Фолбек-скан `PLAYWRIGHT_BROWSERS_PATH`: перебирає теки `chromium-<rev>` за
 * спаданням імені (найновіша ревізія першою — детермінізм при кількох
 * закешованих ревізіях) і повертає перший знайдений `chrome`-бінарник.
 */
function scanBrowsersPath(browsersPath) {
  if (!browsersPath) return null;

  const chromiumDirs = listDirs(browsersPath)
    .filter((name) => CHROMIUM_DIR_RE.test(name))
    .sort()
    .reverse();

  for (const chromiumDir of chromiumDirs) {
    const chromiumPath = join(browsersPath, chromiumDir);
    const chromeLinuxDirs = listDirs(chromiumPath).filter((name) =>
      CHROME_LINUX_DIR_RE.test(name),
    );
    for (const chromeLinuxDir of chromeLinuxDirs) {
      const candidate = join(chromiumPath, chromeLinuxDir, 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Резолвити launch-опції Chromium для playwright-модуля (`chromium` з
 * `@playwright/test` або `playwright`). Кидає з ТОЧНОЮ командою установки,
 * якщо бінарника не знайдено жодним зі шляхів.
 * @param {{ executablePath(): string }} chromium
 * @returns {{ executablePath: string }}
 */
export function resolveChromium(chromium) {
  const declared = chromium.executablePath();
  if (declared && existsSync(declared)) {
    return { executablePath: declared };
  }

  const fallback = scanBrowsersPath(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (fallback) return { executablePath: fallback };

  throw new Error(
    'Chromium не знайдено (ні штатний шлях playwright, ні фолбек-скан ' +
      'PLAYWRIGHT_BROWSERS_PATH).\n' +
      '  💡 pnpm add -D playwright && pnpm exec playwright install chromium',
  );
}
