#!/usr/bin/env node
/**
 * CLI мапінгу `inspection.json` → `tokens-proposal.json` (задача §2.B/§2.D,
 * план Р1/Р4/Р6b). Тонкий файл — аргументи + IO; кольорова/шрифтова логіка —
 * `lib/map.mjs`, злиття мультивходу — `lib/merge.mjs`. Юзаж:
 * `node .claude/skills/redesign-from-reference/scripts/map-tokens.mjs <inspection.json>... [--out <file>]`.
 * 🔴 N=1 — merge-шлях ПОВНІСТЮ оминається (early return у `main`, Р6b): стара
 * поведінка байт-у-байт, без залежності від `lib/merge.mjs`. N>1 — `--out`
 * обовʼязковий (дефолт-здогадка з першої вхідної теки була б помилковою).
 */
import { isCliEntry } from './lib/cli-entry.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mapTokens } from './lib/map.mjs';
import { mergeInspections } from './lib/merge.mjs';

const USAGE =
  'node .claude/skills/redesign-from-reference/scripts/map-tokens.mjs <inspection.json>... [--out <tokens-proposal.json>]';

/** Розбір argv: позиційні токени — шляхи до `inspection.json` (1..N), далі `--out <file>`. */
export function parseArgs(argv) {
  const options = { inspectionPaths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець: ${arg}`);
    else options.inspectionPaths.push(arg);
  }
  if (options.inspectionPaths.length === 0)
    throw new Error(`Потрібен шлях до inspection.json: ${USAGE}`);
  if (options.inspectionPaths.length > 1 && !options.out)
    throw new Error(
      `Кілька inspection.json (мультивхід, Р6b) — --out обовʼязковий, ` +
        `бо вивід не можна вгадати з однієї з тек сторінок: ${USAGE}`,
    );
  if (!options.out)
    options.out = join(
      dirname(options.inspectionPaths[0]),
      'tokens-proposal.json',
    );
  return options;
}

/** Топ-N мапінгів `tokens` для stdout-підсумку (dark і не-кольори — окремо). */
function summarizeMappings(tokens, limit = 6) {
  return Object.entries(tokens)
    .filter(([key]) => key !== 'dark')
    .slice(0, limit)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n');
}

/** Гучний exit-1 — так само, як `inspect.mjs`: помилки видимі, не тихий крах. */
function failLoud(error) {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    failLoud(error);
    return;
  }

  const inspections = [];
  try {
    for (const path of options.inspectionPaths) {
      try {
        inspections.push(JSON.parse(readFileSync(path, 'utf8')));
      } catch (error) {
        throw new Error(`Не вдалося прочитати ${path}: ${error.message}`);
      }
    }
  } catch (error) {
    failLoud(error);
    return;
  }

  // Р6b: N=1 оминає merge-шлях повністю — стара поведінка байт-у-байт.
  const isMultiInput = inspections.length > 1;
  const inspection = isMultiInput
    ? mergeInspections(inspections)
    : inspections[0];

  const proposal = mapTokens(inspection);
  if (isMultiInput) {
    proposal.sources = options.inspectionPaths.map((file, i) => ({
      file,
      url: inspections[i].url,
    }));
  }
  writeFileSync(options.out, JSON.stringify(proposal, null, 2), 'utf8');

  console.log(`✅ ${options.out}`);
  if (isMultiInput) {
    console.log(`Джерел злито: ${proposal.sources.length}`);
  }
  console.log('Топ-мапінги:');
  console.log(summarizeMappings(proposal.tokens));
  if (proposal.tokens.dark) {
    console.log(`  dark: ${Object.keys(proposal.tokens.dark).length} токенів`);
  }
  if (proposal.fonts?.length) {
    console.log(
      `Шрифти (Google Fonts, підтверджено): ${proposal.fonts.map((f) => f.stylesheet).join(', ')}`,
    );
  }
  if (proposal.contrastWarnings.length > 0) {
    console.log(
      `⚠️  Проблеми контрасту (WCAG AA): ${proposal.contrastWarnings.length}`,
    );
    for (const w of proposal.contrastWarnings) {
      console.log(
        `  ${w.pair}: ${w.ratio.toFixed(2)}:1 (потрібно ${w.required}:1)`,
      );
    }
  }
  if (proposal.unmapped.length > 0) {
    console.log(
      `ℹ️  Немапованих кольорів: ${proposal.unmapped.length} — ${proposal.unmapped.join(', ')}`,
    );
  }
}

// Запускати CLI лише при прямому виконанні (isCliEntry — realpath-сумісний
// із канонічним симлінк-шляхом .claude/skills), не при імпорті в тестах.
if (isCliEntry(import.meta.url)) {
  main();
}
