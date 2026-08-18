#!/usr/bin/env node
/**
 * CLI дискаверера сторінок референс-сайту (задача §2.C, план Р4/Р5/Р7).
 * Тонкий файл — аргументи + launch chromium + відкриття СТАРТОВОЇ сторінки;
 * збір лінків — `lib/collect-links.mjs`, візит кандидата з контент-пробом —
 * `lib/visit-candidate.mjs`, побудова пропозиції (класифікація + перепідбір
 * при невдалому візиті) — `lib/sitemap.mjs`. Юзаж:
 * `node .claude/skills/redesign-from-reference/scripts/discover.mjs <startUrl> [--out <file>] [--max-visits N]`.
 */
import { isCliEntry } from './lib/cli-entry.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  loadChromium,
  resolveChromium,
  scrollThrough,
} from './lib/browser.mjs';
import { collectLinks } from './lib/collect-links.mjs';
import { buildSitemapProposal } from './lib/sitemap.mjs';
import { visitCandidate } from './lib/visit-candidate.mjs';
import { browserVisitProbe } from './lib/visit-probe.mjs';
import { slugify } from './inspect.mjs';

const DEFAULT_MAX_VISITS = 8;
const USAGE =
  'node .claude/skills/redesign-from-reference/scripts/discover.mjs <startUrl> [--out <file>] [--max-visits N]';

/** Розбір argv: перший позиційний токен — стартовий URL, далі `--out <file>`/`--max-visits <N>`. */
export function parseArgs(argv) {
  const options = { maxVisits: DEFAULT_MAX_VISITS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg === '--max-visits') options.maxVisits = Number(argv[++i]);
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець: ${arg}`);
    else if (!options.url) options.url = arg;
    else throw new Error(`Зайвий аргумент: ${arg}`);
  }
  if (!options.url) throw new Error(`Потрібен URL: ${USAGE}`);
  if (!Number.isFinite(options.maxVisits) || options.maxVisits <= 0)
    throw new Error(`--max-visits має бути додатним числом: ${USAGE}`);
  return options;
}

/** Гучний exit-1 — той самий канал, що `inspect.mjs` (Р4: «спільний канал»). */
function failLoud(error) {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const chromium = await loadChromium();
  let out;
  let launchOptions;
  try {
    out =
      options.out ??
      join(
        'docs',
        'design-references',
        slugify(options.url),
        'sitemap-proposal.json',
      );
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
    if (!response || !response.ok()) {
      throw new Error(
        `HTTP ${response ? response.status() : '(без відповіді)'} від референсу — ` +
          'дискавері зупинено (доступ закритий або бот-захист; ' +
          'див. «Чесна деградація» у скілі redesign-from-reference)',
      );
    }
    await scrollThrough(page); // лінки з лінивих секцій/футера — теж мають потрапити в DOM-обхід
    const links = await collectLinks(page);

    const proposal = await buildSitemapProposal({
      links,
      startUrl: options.url,
      maxVisits: options.maxVisits,
      visit: (url, type) => visitCandidate(page, url, type, browserVisitProbe),
    });

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(proposal, null, 2), 'utf8');

    console.log(
      `✅ ${out} — типів знайдено: ${Object.keys(proposal.pageTypes).length}, ` +
        `unresolved: ${proposal.unresolved.length}, лінків побачено: ${proposal.links.length}`,
    );
    for (const [type, info] of Object.entries(proposal.pageTypes)) {
      console.log(
        `  ${type}: ${info.url}${info.visited ? '' : ' (не відвідано — ліміт)'}`,
      );
    }
    for (const entry of proposal.unresolved) {
      console.log(`  ⚠️  ${entry.type}: ${entry.reason}`);
    }
  } catch (error) {
    failLoud(error);
  } finally {
    await browser.close();
  }
}

// Запускати CLI лише при прямому виконанні (isCliEntry — realpath-сумісний
// із канонічним симлінк-шляхом .claude/skills), не при імпорті в тестах.
if (isCliEntry(import.meta.url)) {
  main();
}
