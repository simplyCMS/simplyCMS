import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { InstalledFileMissingError } from '../lib/installed-package';

/**
 * Парність реєстру обходів і коду + читання розтяжки для
 * `upstream-tripwires.test.ts`. Тут лише логіка; жодних `describe`/`it`.
 */

const ROOT = resolve(import.meta.dirname, '../..');
export const REGISTRY_PATH = join(
  ROOT,
  'docs/architecture/upstream-workarounds.md',
);
const TRIPWIRE_FILE = 'tests/upstream-tripwires.test.ts';
/** Допоміжні модулі цього гейта цитують ID у даних і повідомленнях — маркерами коду не є. */
const SELF_DIR = 'tests/upstream-tripwires/';

export function readForTripwire(id: string, read: () => string): string {
  try {
    return read();
  } catch (err) {
    if (err instanceof InstalledFileMissingError)
      throw new Error(
        `UPSTREAM:${id} — файл ${err.relPath} у ${err.pkg}@${err.version} не знайдено: бібліотека змінила структуру, переглянь запис реєстру`,
      );
    throw err;
  }
}

// ---------- парність код ↔ реєстр ----------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  // Git-ігнорований робочий простір агентів (журнали, брифи SDD): цитує ID
  // з планів, а не несе обходів — інакше локальний прогін червонів би.
  '.superpowers',
  'docs',
  'coverage',
  '.output',
]);
const SOURCE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|json|ya?ml|md)$/;
const MARKER = /UPSTREAM:([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[A-Z0-9]*\d)/g;

/** Усі маркери `UPSTREAM:<ID>` у коді (без самого цього файлу — він цитує ID). */
export function codeMarkers(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
      } else if (SOURCE_EXT.test(e.name)) {
        const file = join(dir, e.name);
        // Кореневі *.md (AGENTS, CHANGELOG, README) — проза й історія, не носії обходу.
        if (dir === ROOT && e.name.endsWith('.md')) continue;
        const rel = relative(ROOT, file).replaceAll('\\', '/');
        if (rel === TRIPWIRE_FILE || rel.startsWith(SELF_DIR)) continue;
        for (const m of readFileSync(file, 'utf8').matchAll(MARKER))
          found.add(m[1] as string);
      }
    }
  };
  walk(ROOT);
  return found;
}

/** Активні записи реєстру: ID → текст запису (секція `###` або рядок таблиці «на що спираємося»). */
export function activeRecords(registry: string): Map<string, string> {
  const start = registry.indexOf('\n## Активні');
  const end = registry.indexOf('\n## Закриті');
  const active = registry.slice(start, end);
  const out = new Map<string, string>();
  for (const part of active.split(/^### /m).slice(1)) {
    const id = /^([A-Z][A-Z0-9-]*\d)\b/.exec(part)?.[1];
    if (id) out.set(id, part);
  }
  for (const row of active.matchAll(/^\| ([A-Z][A-Z0-9-]*\d) \|.*$/gm)) {
    out.set(row[1] as string, row[0]);
  }
  return out;
}

/** Порушення парності: чиста функція від реєстру, маркерів коду й набору розтяжок. */
export function parityProblems(
  registry: string,
  markers: ReadonlySet<string>,
  tripwireIds: readonly string[],
): string[] {
  const records = activeRecords(registry);
  const problems: string[] = [];
  for (const id of markers) {
    if (!records.has(id))
      problems.push(
        `маркер UPSTREAM:${id} у коді без активного запису в реєстрі`,
      );
  }
  for (const id of tripwireIds) {
    if (!records.has(id))
      problems.push(`розтяжка ${id} без активного запису (мертва)`);
  }
  for (const [id, text] of records) {
    const hasTripwire = tripwireIds.includes(id);
    const namesTripwire = text.includes(TRIPWIRE_FILE);
    const exempt = /\| Розтяжка: немає \| \S[^|]*\|/.test(text);
    if (hasTripwire && !namesTripwire)
      problems.push(`${id}: розтяжка є, запис її не називає`);
    if (hasTripwire && exempt)
      problems.push(`${id}: і розтяжка, і «Розтяжка: немає»`);
    if (!hasTripwire && !exempt)
      problems.push(`${id}: ні розтяжки, ні «| Розтяжка: немає | <причина> |»`);
    if (!hasTripwire && namesTripwire && !exempt)
      problems.push(`${id}: запис називає розтяжку, якої немає`);
    if (!markers.has(id) && !/\| Маркери: немає \| \S[^|]*\|/.test(text)) {
      problems.push(
        `${id}: немає маркерів у коді і немає «| Маркери: немає | <причина> |»`,
      );
    }
    if (markers.has(id) && /\| Маркери: немає \|/.test(text)) {
      problems.push(`${id}: маркери в коді є, а запис каже «Маркери: немає»`);
    }
  }
  return problems;
}
