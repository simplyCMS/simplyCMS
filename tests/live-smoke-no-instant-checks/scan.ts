import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Сканер миттєвих читань у `scripts/live-smoke/**` для
 * `live-smoke-no-instant-checks.test.ts` (що стереже і чому — у шапці тесту).
 * Тут лише логіка; жодних `describe`/`it`.
 */

export const ROOT = resolve(import.meta.dirname, '../..');
export const DIR = join(ROOT, 'scripts/live-smoke');

const INSTANT =
  /\.(?:isVisible|isHidden|isChecked|isEnabled|isDisabled|isEditable|textContent|innerText|inputValue|allTextContents|allInnerTexts)\(|\.count\(\)/;

/** Лише код: коментарі з поясненням «чому не isVisible» не рахуються. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Миттєві читання тексту: `{file, call}` на кожен збіг (з повторами). */
export function findInstantReads(
  file: string,
  src: string,
): { file: string; call: string }[] {
  const lines = stripComments(src).split('\n');
  const out: { file: string; call: string }[] = [];
  lines.forEach((line, i) => {
    if (!INSTANT.test(line)) return;
    // Ланцюжок `.a()\n.b()` — разом із головою, інакше `.textContent()) ?? ''`
    // однаковий у різних місцях файла.
    const parts = [line.trim()];
    for (let j = i; j > 0 && (lines[j] as string).trim().startsWith('.'); j--)
      parts.unshift((lines[j - 1] as string).trim());
    out.push({ file, call: parts.join(' ').replace(/\s+/g, ' ') });
  });
  return out;
}

export function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.(mjs|mts|ts|js)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

/** Усі миттєві читання в скриптах смоку (без `wait.mjs` — там самі помічники). */
export function scanLiveSmoke(): { file: string; call: string }[] {
  const files = [...walk(DIR), join(ROOT, 'scripts/live-smoke.mjs')].filter(
    (f) => !f.endsWith('/wait.mjs'),
  );
  return files.flatMap((f) =>
    findInstantReads(
      relative(DIR, f).replaceAll('\\', '/'),
      readFileSync(f, 'utf8'),
    ),
  );
}

export const keyOf = (e: { file: string; call: string }): string =>
  `${e.file} :: ${e.call}`;
/** Збіги, яких не покриває список (кратність враховано). */
export function uncovered(
  hits: readonly { file: string; call: string }[],
  list: ReadonlyMap<string, number>,
): string[] {
  const left = new Map(list);
  const bad: string[] = [];
  for (const h of hits) {
    const k = keyOf(h);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else bad.push(k);
  }
  return bad;
}
