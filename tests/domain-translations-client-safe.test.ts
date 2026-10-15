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
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
  isServerOnlySubpath,
  serverOnlyDepSpecifier,
} from '../packages/simplycms/src/contracts/server-only';

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
const SRC = resolve(import.meta.dirname, '../packages/simplycms/src');
const ROOTS = ['domain/translations', 'domain/slugs'].map((r) =>
  resolve(SRC, r),
);

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
  const base = spec.startsWith('.')
    ? resolve(dirname(from), spec)
    : spec.startsWith('simplycms/')
      ? resolve(SRC, spec.slice('simplycms/'.length))
      : null;
  if (!base) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Транзитивне замикання локальних імпортів від коренів + порушення. */
function scan(roots: string[]): { files: string[]; violations: string[] } {
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

describe('domain/translations і domain/slugs клієнтобезпечні (T1)', () => {
  const { files, violations } = scan(ROOTS);

  it('розбір справді бачить обидва дерева (порожній скан нічого б не довів)', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'domain/translations/index.ts',
        'domain/translations/write-plan.ts',
        'domain/slugs/index.ts',
        'domain/slugs/translit-uk.ts',
      ]),
    );
  });

  it('декларація server-only непорожня і містить translations (сентинел самого скану)', () => {
    expect(SERVER_ONLY).toContain('translations');
    expect(isServerOnlySubpath('translations')).toBe(true);
    expect(isServerOnlySubpath('domain/translations')).toBe(false);
  });

  it('жодного node:, server-only субшляху чи серверної залежності в замиканні', () => {
    expect(violations).toEqual([]);
  });

  it('негативний контроль: скан ловить node: і server-only у ТРАНЗИТИВНОМУ імпорті', () => {
    const dir = mkdtempSync(join(tmpdir(), 'client-safe-'));
    try {
      mkdirSync(join(dir, 'root'));
      writeFileSync(
        join(dir, 'root', 'a.ts'),
        `import { b } from '../helper/b';\nexport const a = b;\n`,
      );
      mkdirSync(join(dir, 'helper'));
      writeFileSync(
        join(dir, 'helper', 'b.ts'),
        `import { createHash } from 'node:crypto';\n` +
          `import { sourceFieldHash } from 'simplycms/translations';\n` +
          `export const b = [createHash, sourceFieldHash];\n`,
      );
      const found = scan([join(dir, 'root')]).violations;
      expect(found.some((v) => v.startsWith('node:'))).toBe(true);
      expect(found.some((v) => v.startsWith('server-only:'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
