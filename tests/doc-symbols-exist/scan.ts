import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Сканер доків і чиста логіка пошуку відсутніх символів для `doc-symbols-exist.test.ts` (що стереже і
 * чому — у шапці тесту). Тут лише логіка; жодних `describe`/`it`.
 */

export const ROOT = resolve(import.meta.dirname, '../..');
/**
 * Маркер історичної згадки: `(знесено…)` / `(замінено…)` БЕЗПОСЕРЕДНЬО після
 * символу в лапках (через пробіли). Діє на цей символ, а не на весь рядок.
 */
const HISTORICAL_AFTER = /^\s*\((?:знесено|замінено)/;

// ---------- чиста логіка (під негативні контролі) ----------

export type DocFile = { path: string; text: string };

const isSymbolLike = (s: string): boolean =>
  /^[a-z_$][a-z0-9_$]*[A-Z][\w$]*$/.test(s) || // camelCase з великою всередині
  /^[A-Z][a-z0-9]+[A-Z][\w$]*$/.test(s) || // PascalCase
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(s); // UPPER_SNAKE

/** Символи-кандидати в рядку (без тих, за якими стоїть маркер): ціле вмістиме лапок, опційно з `()`. */
function symbolsInLine(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/`([^`\n]+)`/g)) {
    const id = /^([A-Za-z_$][\w$]*)(?:\(\))?$/.exec(m[1] as string)?.[1];
    if (!id || !isSymbolLike(id)) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length);
    if (HISTORICAL_AFTER.test(rest)) continue;
    out.push(id);
  }
  return out;
}

/** Блоки ``` стираються, ПЕРЕНОСИ лишаються — номери рядків не зсуваються. */
const stripFences = (text: string): string =>
  text.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ''));

export type Missing = { symbol: string; where: string[] };

/** Символи доків, яких немає в індексі коду, без історичних рядків. */
export function missingSymbols(
  docs: readonly DocFile[],
  index: ReadonlySet<string>,
): Missing[] {
  const found = new Map<string, string[]>();
  for (const doc of docs) {
    stripFences(doc.text)
      .split('\n')
      .forEach((line, i) => {
        for (const sym of symbolsInLine(line)) {
          if (index.has(sym)) continue;
          (found.get(sym) ?? found.set(sym, []).get(sym))?.push(
            `${doc.path}:${i + 1}`,
          );
        }
      });
  }
  return [...found].map(([symbol, where]) => ({ symbol, where }));
}

// ---------- збір файлів ----------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'coverage',
  '.output',
]);

export function walk(
  dir: string,
  accept: (rel: string) => boolean,
  out: string[] = [],
): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, accept, out);
    } else if (accept(relative(ROOT, full).replaceAll('\\', '/')))
      out.push(full);
  }
  return out;
}

export const CODE_EXT = /\.(?:tsx?|mts|cts|mjs|cjs|js|sql|json|css)$/;
const isDoc = (rel: string): boolean =>
  rel.endsWith('.md') &&
  (/^docs\/(?:architecture|development)\//.test(rel) ||
    /^packages\/[^/]+\/README\.md$/.test(rel) ||
    /^packages\/simplycms\/src\/.*README\.md$/.test(rel) ||
    rel.startsWith('packages/simplycms/skills/'));

export function collectDocs(): DocFile[] {
  return [
    ...walk(join(ROOT, 'docs'), isDoc),
    ...walk(join(ROOT, 'packages'), isDoc),
  ].map((f) => ({
    path: relative(ROOT, f).replaceAll('\\', '/'),
    text: readFileSync(f, 'utf8'),
  }));
}
