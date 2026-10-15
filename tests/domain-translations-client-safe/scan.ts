// Статичний скан клієнтобезпечності T1-дерев (використовує
// `tests/domain-translations-client-safe.test.ts`; окремо, щоб тримати файли
// в межах ~150 рядків).
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import {
  SERVER_ONLY_DEPS,
  isServerOnlySubpath,
  serverOnlyDepSpecifier,
} from '../../packages/simplycms/src/contracts/server-only';

/**
 * `domain/translations` і `domain/slugs` — T1: їх імпортує й клієнтський
 * бандл адмінки (бейджі статусів, прев'ю адрес). Тому ні вони, ні їхні
 * транзитивні локальні імпорти не можуть тягти `node:` чи server-only субшлях;
 * sha256 живе лише в серверному `simplycms/translations`.
 *
 * 🔴 Статичний розбір, а не «імпортували й не впало»: у vitest `node:crypto`
 * доступний, тож динамічна перевірка клієнтської безпеки нічого б не довела.
 * Перелік server-only береться з єдиної декларації `contracts/server-only`.
 */
export const SRC = resolve(import.meta.dirname, '../../packages/simplycms/src');
export const ROOTS = ['domain/translations', 'domain/slugs'].map((r) =>
  resolve(SRC, r),
);

/** Вбудовані модулі Node без префікса: `fs`, `path/posix`, `crypto` — той самий вантаж, що й `node:fs`. */
const BUILTINS = new Set(builtinModules);

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const specifiersOf = (code: string): string[] =>
  [...code.matchAll(IMPORT_RE)].map((m) => (m[1] ?? m[2] ?? m[3])!);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory())
      return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });

/** Файл, на який вказує специфікатор усередині пакета, або null (зовнішній). */
function resolveLocal(from: string, spec: string): string | null {
  const raw = spec.startsWith('.')
    ? resolve(dirname(from), spec)
    : spec.startsWith('simplycms/')
      ? resolve(SRC, spec.slice('simplycms/'.length))
      : null;
  if (!raw) return null;
  // ESM-специфікатор `./x.js` вказує на джерело `./x.ts`: без цього імпорт
  // із розширенням пройшов би повз скан разом зі своїм замиканням.
  const base = raw.replace(/\.(?:m?js|jsx)$/, '');
  const candidates = [
    raw,
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Транзитивне замикання локальних імпортів від коренів + порушення. */
export function scan(roots: string[]): {
  files: string[];
  violations: string[];
} {
  const queue = roots.flatMap((root) => sourceFiles(root));
  const seen = new Set<string>();
  const violations: string[] = [];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
      const where = `${relative(SRC, file)} → ${spec}`;
      if (spec.startsWith('node:')) violations.push(`node: ${where}`);
      else if (BUILTINS.has(spec)) violations.push(`builtin: ${where}`);
      if (
        spec.startsWith('simplycms/') &&
        isServerOnlySubpath(spec.slice('simplycms/'.length))
      )
        violations.push(`server-only: ${where}`);
      if (SERVER_ONLY_DEPS.some((d) => serverOnlyDepSpecifier(d).test(spec)))
        violations.push(`серверна залежність: ${where}`);
      const next = resolveLocal(file, spec);
      if (next) queue.push(next);
    }
  }
  return { files: [...seen].map((f) => relative(SRC, f)).sort(), violations };
}

/** Скан тимчасового дерева: `root/` — корінь скану, решта досяжна лише імпортами. */
export function scanFixture(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'client-safe-'));
  try {
    for (const [path, code] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), code);
    }
    return scan([join(dir, 'root')]).violations;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
