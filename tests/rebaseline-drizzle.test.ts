import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Гейт детермінізму `pnpm db:rebaseline` (Р6 майстер-плану хвилі
 * мультимовності): снапшоти drizzle раніше правили руками, а `drizzle-kit
 * generate` не детермінований (`id` снапшота — випадковий UUID, `when` у
 * журналі — `Date.now()`). Без нормалізації два прогони поспіль давали б
 * безглуздий диф у кожному коміті, що чіпає `schema.ts`.
 *
 * Скрипт запускається на КОПІЇ пакета в tmp (`--root`): реальні `drizzle/` і
 * `migrations/` тут не змінюються ніколи. `drizzle-kit` ходить без мережі й БД,
 * тож тест у дефолтному `pnpm test`, а не в `pnpm test:schema`.
 */

const REPO = resolve(import.meta.dirname, '..');
const PKG = join(REPO, 'packages/simplycms');
const SCRIPT = join(REPO, 'scripts/rebaseline-drizzle.mjs');

/** `sha256` усіх файлів теки (рекурсивно): відносний шлях → хеш вмісту. */
function hashTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    out[relative(dir, file)] = createHash('sha256')
      .update(readFileSync(file))
      .digest('hex');
  }
  return out;
}

/** Хеші всього, що пише скрипт: `drizzle/**` і `migrations/0001_init.sql`. */
function snapshotOf(pkgDir: string): Record<string, string> {
  const init = join(pkgDir, 'migrations/0001_init.sql');
  return {
    ...Object.fromEntries(
      Object.entries(hashTree(join(pkgDir, 'drizzle'))).map(([k, v]) => [
        `drizzle/${k}`,
        v,
      ]),
    ),
    'migrations/0001_init.sql': createHash('sha256')
      .update(readFileSync(init))
      .digest('hex'),
  };
}

let tmpRoot: string;
let tmpPkg: string;
let committed: Record<string, string>;
let first: Record<string, string>;
let second: Record<string, string>;

function runScript(root: string) {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
    timeout: 90_000,
  });
  expect(
    result.status,
    `rebaseline впав\nstderr: ${result.stderr}\nstdout: ${result.stdout}`,
  ).toBe(0);
}

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'rebaseline-drizzle-'));
  tmpPkg = join(tmpRoot, 'packages/simplycms');
  mkdirSync(join(tmpPkg, 'migrations'), { recursive: true });
  // Схема й стартовий стан drizzle/ — копії; `node_modules` — симлінк, бо
  // `schema.ts` імпортує `drizzle-orm`, а резолв іде від справжнього шляху файла.
  cpSync(join(PKG, 'src/schema'), join(tmpPkg, 'src/schema'), {
    recursive: true,
    filter: (src) => !src.includes('__tests__'),
  });
  cpSync(join(PKG, 'package.json'), join(tmpPkg, 'package.json'));
  cpSync(join(PKG, 'drizzle'), join(tmpPkg, 'drizzle'), { recursive: true });
  cpSync(
    join(PKG, 'migrations/0001_init.sql'),
    join(tmpPkg, 'migrations/0001_init.sql'),
  );
  symlinkSync(join(PKG, 'node_modules'), join(tmpPkg, 'node_modules'));

  committed = snapshotOf(PKG);
  runScript(tmpRoot);
  first = snapshotOf(tmpPkg);
  runScript(tmpRoot);
  second = snapshotOf(tmpPkg);
}, 180_000);

afterAll(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

describe('pnpm db:rebaseline', () => {
  it('два прогони поспіль дають нульовий диф', () => {
    expect(second).toEqual(first);
    // Не порожній порівняльник: снапшот, журнал, SQL і канон справді записані.
    expect(Object.keys(first).sort()).toEqual([
      'drizzle/0000_init.sql',
      'drizzle/meta/0000_snapshot.json',
      'drizzle/meta/_journal.json',
      'migrations/0001_init.sql',
    ]);
  });

  it('закомічені drizzle/** і 0001_init.sql — рівно вивід скрипта зі schema.ts', () => {
    // Ловить ручну правку снапшота чи канону в обхід скрипта.
    expect(first).toEqual(committed);
  });

  it('канон не має 0005, а mail_outbox є в 0001_init', () => {
    expect(existsSync(join(PKG, 'migrations/0005_mail_outbox.sql'))).toBe(
      false,
    );
    expect(existsSync(join(PKG, 'drizzle/0001_mail_outbox.sql'))).toBe(false);
    expect(
      readFileSync(join(PKG, 'migrations/0001_init.sql'), 'utf8'),
    ).toContain('CREATE TABLE "mail_outbox"');
  });
});
