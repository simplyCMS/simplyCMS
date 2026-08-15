#!/usr/bin/env node
/**
 * CLI мапінгу `inspection.json` → `tokens-proposal.json` (задача §2.B, план
 * Р1/Р4). Тонкий файл — аргументи + IO; уся логіка — чиста функція `mapTokens`
 * у `lib/map.mjs`. Юзаж:
 * `node .claude/skills/redesign-from-reference/scripts/map-tokens.mjs <inspection.json> [--out <file>]`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mapTokens } from './lib/map.mjs';

const USAGE =
  'node .claude/skills/redesign-from-reference/scripts/map-tokens.mjs <inspection.json> [--out <tokens-proposal.json>]';

/** Розбір argv: перший позиційний токен — шлях до `inspection.json`, далі `--out <file>`. */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець: ${arg}`);
    else if (!options.inspectionPath) options.inspectionPath = arg;
    else throw new Error(`Зайвий аргумент: ${arg}`);
  }
  if (!options.inspectionPath)
    throw new Error(`Потрібен шлях до inspection.json: ${USAGE}`);
  if (!options.out)
    options.out = join(dirname(options.inspectionPath), 'tokens-proposal.json');
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

  let inspection;
  try {
    inspection = JSON.parse(readFileSync(options.inspectionPath, 'utf8'));
  } catch (error) {
    failLoud(
      new Error(
        `Не вдалося прочитати ${options.inspectionPath}: ${error.message}`,
      ),
    );
    return;
  }

  const proposal = mapTokens(inspection);
  writeFileSync(options.out, JSON.stringify(proposal, null, 2), 'utf8');

  console.log(`✅ ${options.out}`);
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

// Запускати CLI лише при прямому виконанні — не при імпорті функцій у тестах.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
