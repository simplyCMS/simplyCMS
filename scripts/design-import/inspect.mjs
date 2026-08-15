#!/usr/bin/env node
/**
 * CLI інспекції референс-сайту (задача §2.A, план Р1-Р4). Тонкий файл —
 * аргументи + launch chromium + IO; резолюція бінарника й `loadChromium` —
 * `lib/browser.mjs`, скріншоти/семплінг — `lib/sample.mjs`, сама інспекція
 * сторінки — `lib/inspect-page.mjs` (реекспортовано звідси — тести й
 * `--dark`-контракт лишаються стабільним публічним API цього файлу).
 * Юзаж: `inspect.mjs <url> [--out d] [--dark]`.
 */
import { join } from 'node:path';
import { loadChromium, resolveChromium } from './lib/browser.mjs';
import { inspectPage } from './lib/inspect-page.mjs';

export { inspectPage };

const USAGE =
  'node scripts/design-import/inspect.mjs <url> [--out <dir>] [--dark]';

/** Розбір argv: перший позиційний токен — URL, далі `--out <dir>`/`--dark`. */
export function parseArgs(argv) {
  const options = { dark: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dark') options.dark = true;
    else if (arg === '--out') options.out = argv[++i];
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець: ${arg}`);
    else if (!options.url) options.url = arg;
    else throw new Error(`Зайвий аргумент: ${arg}`);
  }
  if (!options.url) throw new Error(`Потрібен URL: ${USAGE}`);
  return options;
}

/** Слаг з host+path референс-URL — дефолтний `docs/design-references/<slug>`. */
export function slugify(url) {
  const parsed = new URL(url);
  const raw = `${parsed.host}${parsed.pathname}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return raw || 'site';
}

/** Гучний exit-1 — задача §2.A: мережеві збої видимі, не порожній JSON. */
function failLoud(error) {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const chromium = await loadChromium();
  // Pre-launch валідація: і невалідний URL (`new URL` у slugify), і відсутній
  // браузер мають падати одним каналом `failLoud`, а не сирим стектрейсом.
  let out;
  let launchOptions;
  try {
    out =
      options.out ?? join('docs', 'design-references', slugify(options.url));
    launchOptions = resolveChromium(chromium);
  } catch (error) {
    failLoud(error);
  }

  const browser = await chromium.launch({ headless: true, ...launchOptions });
  try {
    const page = await browser.newPage();
    console.log(`🔎 Відкриваю ${options.url}…`);
    const response = await page.goto(options.url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    // `page.goto` НЕ кидає на 4xx/5xx (лише на мережеві збої) — без цієї
    // перевірки 401/403/бот-заглушка давала б «успішний» inspection.json з
    // кольорами сторінки-відмови. `response` може бути null (same-document).
    if (!response || !response.ok()) {
      throw new Error(
        `HTTP ${response ? response.status() : '(без відповіді)'} від референсу — ` +
          'інспекцію зупинено (доступ закритий або бот-захист; ' +
          'див. «Чесна деградація» у скілі redesign-from-reference)',
      );
    }
    const inspection = await inspectPage(page, {
      url: options.url,
      out,
      dark: options.dark,
    });
    console.log(
      `✅ ${out}/inspection.json — кольорів: ${inspection.colors.length}, ` +
        `radius: ${inspection.radius.length} (відкинуто pill/full: ${inspection.radiusDropped}), ` +
        `dark: ${inspection.darkDetected}`,
    );
  } catch (error) {
    failLoud(error);
  } finally {
    await browser.close();
  }
}

// Запускати CLI лише при прямому виконанні — не при імпорті функцій у тестах.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
