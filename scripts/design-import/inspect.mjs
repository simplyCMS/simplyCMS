#!/usr/bin/env node
/**
 * CLI інспекції референс-сайту (задача §2.A, план Р1-Р4). Playwright —
 * ДИНАМІЧНИЙ import: спершу `@playwright/test`, фолбек `playwright`. Тонкий
 * файл — аргументи + IO; семплінг/скріншоти — `lib/sample.mjs`, резолюція
 * бінарника — `lib/browser.mjs`. Юзаж: `inspect.mjs <url> [--out d] [--dark]`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveChromium } from './lib/browser.mjs';
import { captureScreenshots, samplePalette } from './lib/sample.mjs';

const SCHEMA_VERSION = 1;
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

/** Порівняння світлого/темного семплу за фоном+текстом — чесний `darkDetected`. */
function paletteSignature(colors) {
  return colors
    .filter((c) => c.role === 'background' || c.role === 'text')
    .map((c) => c.value)
    .sort()
    .join(',');
}

/**
 * Інспектувати вже завантажену сторінку (навігацію робить викликач: `main` —
 * `page.goto`, тест-фікстура — `page.setContent`): скріншоти + світлий +
 * опційно темний семпл (`--dark`). Пише `inspection.json` в `out`.
 */
export async function inspectPage(page, { url, out, dark }) {
  mkdirSync(out, { recursive: true });
  const viewports = await captureScreenshots(page, out);
  const light = await samplePalette(page);

  let darkColors = null;
  if (dark) {
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkSample = await samplePalette(page);
    await page.emulateMedia({ colorScheme: 'light' });
    if (paletteSignature(light.colors) !== paletteSignature(darkSample.colors))
      darkColors = darkSample.colors;
  }
  const darkDetected = darkColors !== null;

  const inspection = {
    schemaVersion: SCHEMA_VERSION,
    url,
    viewports,
    colors: light.colors,
    fonts: light.fonts,
    radius: light.radius,
    shadows: light.shadows,
    spacing: light.spacing,
    fontStylesheets: light.fontStylesheets,
    darkDetected,
    ...(darkColors ? { dark: { colors: darkColors } } : {}),
  };

  writeFileSync(
    join(out, 'inspection.json'),
    JSON.stringify(inspection, null, 2),
    'utf8',
  );
  return inspection;
}

/** Резолв playwright-модуля: спершу devDep-монорепо, потім bare `playwright`. */
async function loadChromium() {
  for (const specifier of ['@playwright/test', 'playwright']) {
    try {
      return (await import(specifier)).chromium;
    } catch {
      // Пакета немає — пробуємо наступний, повідомлення нижче.
    }
  }
  console.error(
    '❌ Playwright не знайдено.\n  💡 pnpm add -D playwright && pnpm exec playwright install chromium',
  );
  process.exit(1);
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
      `✅ ${out}/inspection.json — кольорів: ${inspection.colors.length}, radius: ${inspection.radius.length}, dark: ${inspection.darkDetected}`,
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
