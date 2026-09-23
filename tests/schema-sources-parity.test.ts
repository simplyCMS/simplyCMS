import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Гейт парності джерел схеми (факт F2 виконання Task 9, Task 12 Step 4а):
 * автоматичної звірки `schema.ts` ↔ `drizzle/meta/0000_snapshot.json` ↔
 * `drizzle/0000_init.sql` ↔ `migrations/0001_init.sql` НЕ БУЛО —
 * `baseline.test.ts` (test:schema) накочує канон і перевіряє інваріанти
 * БД, `rls-parity` звіряє лише політики. Зміна лише `schema.ts` АБО лише
 * канону проходила б усі інші гейти мовчки.
 *
 * Перевіряє ДВА незалежних факти:
 *   1. `drizzle-kit generate` на КОПІЇ `packages/simplycms/drizzle/` не
 *      створює нового файла міграції («No schema changes») — `schema.ts`
 *      не розійшовся зі знімком `meta/0000_snapshot.json`. Реальна
 *      `drizzle/` НЕ ЧІПАЄТЬСЯ НІКОЛИ — працюємо лише з копією у tmp.
 *   2. `migrations/0001_init.sql` (канон, застосовує `test:schema` і
 *      `db:demo`) ≡ `drizzle/0000_init.sql` (те, що видає сам drizzle-kit
 *      із того самого `schema.ts`) після нормалізації — з явним
 *      allowlist свідомих відмінностей і причин, а не «ігнорувати все».
 *
 * 🔴 Час і мережа: `drizzle-kit generate` НЕ підключається до БД (діагноз
 * lifecycle команди — лише `push`/`introspect`/`migrate` ходять у мережу;
 * `dbCredentials` тут узагалі не передається — команда викликана прапорцями
 * `--dialect`/`--schema`/`--out`, без конфіг-файлу). Виміряно ізольовано:
 * ~0.4–0.7 с, без мережі — тому тест у ДЕФОЛТНОМУ `pnpm test`, не в
 * `pnpm test:schema`.
 *
 * 🔴 `--out` мусить бути ВІДНОСНИМ і cwd процесу — сам tmp-корінь:
 * drizzle-kit 0.31 у `generate` склеює `./${out}` і на абсолютному шляху
 * падає з ENOENT (та сама пастка, що в `drizzle.config.ts` реального
 * пакета — коментар там документує її для `dbCredentials`-конфіга,
 * тут — для прапорця).
 */

const ROOT = resolve(import.meta.dirname, '..');
const SCHEMA_PATH = resolve(ROOT, 'packages/simplycms/src/schema/schema.ts');
const REAL_DRIZZLE_DIR = resolve(ROOT, 'packages/simplycms/drizzle');
const REAL_MIGRATIONS_FILE = resolve(
  ROOT,
  'packages/simplycms/migrations/0001_init.sql',
);
const DRIZZLE_KIT_BIN = resolve(ROOT, 'node_modules/.bin/drizzle-kit');

/**
 * Свідомі відмінності `migrations/0001_init.sql` від того, що видає
 * `drizzle-kit generate` із `schema.ts`: два ЧИСТО ДОКУМЕНТАЦІЙНІ
 * `COMMENT ON COLUMN` (контракт id, В13/Е1а) — drizzle-kit їх не емітить,
 * бо `schema.ts` не оголошує `.comment(...)` на колонках (жодна версія
 * drizzle-orm тут API коментарів не використовує). `COMMENT ON COLUMN` не
 * впливає на семантику схеми — це нотатка для того, хто читає БД напряму
 * (`\d+ products` у psql). Список — рівно ці два рядки, нових без
 * оновлення цього списку бути не може (третій тест нижче).
 */
const ALLOWLIST_MIGRATION_ONLY_LINES = [
  `COMMENT ON COLUMN "products"."id" IS 'Категорія A: ключ генерує ВИКЛИКАЧ, не БД. Для сторінок адмінки це браузер (crypto.randomUUID()), для суто серверних таблиць (themes, plugins, user_roles, profiles) — randomUUID() на сервері. DEFAULT знято навмисно — fail-loud guard проти розсинхрону оптимістичного й серверного ключа.';`,
  `COMMENT ON COLUMN "orders"."id" IS 'Категорія A: client-generated UUID. Ключ шле сервер (order-create), DEFAULT знято в Е1а — сітка перестала страхувати після Е0.';`,
];

/**
 * Прибирає `--> statement-breakpoint` (роздільник drizzle-kit, не частина
 * SQL — присутній ОБОМА джерелами однаково) і порожні рядки, вирівнює
 * кінцеві пробіли — щоб різниця у форматуванні (кінцевий `\n`, останній
 * маркер) не рахувалась різницею СХЕМИ.
 */
function normalizeLines(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--> statement-breakpoint\s*$/, '').trimEnd())
    .filter((line) => line.length > 0);
}

let tmpDir: string;
let tmpDrizzleDir: string;
let generateResult: ReturnType<typeof spawnSync>;

beforeAll(() => {
  expect(
    existsSync(DRIZZLE_KIT_BIN),
    `drizzle-kit не знайдено за ${DRIZZLE_KIT_BIN} — install зламаний`,
  ).toBe(true);

  tmpDir = mkdtempSync(join(tmpdir(), 'schema-sources-parity-'));
  tmpDrizzleDir = join(tmpDir, 'drizzle');
  // Копія КАНОНУ drizzle-kit (baseline SQL + meta/snapshot+journal) —
  // реальна `packages/simplycms/drizzle/` після цього рядка більше НІДЕ
  // не згадується як шлях запису.
  cpSync(REAL_DRIZZLE_DIR, tmpDrizzleDir, { recursive: true });

  generateResult = spawnSync(
    DRIZZLE_KIT_BIN,
    [
      'generate',
      '--dialect=postgresql',
      `--schema=${SCHEMA_PATH}`,
      '--out=./drizzle',
    ],
    { cwd: tmpDir, encoding: 'utf8', timeout: 20_000 },
  );
});

afterAll(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe('парність джерел схеми: schema.ts ↔ meta-знімок', () => {
  it('drizzle-kit generate завершується успішно', () => {
    expect(
      generateResult.status,
      `stderr: ${generateResult.stderr}\nstdout: ${generateResult.stdout}`,
    ).toBe(0);
  });

  it('«No schema changes» — schema.ts не розійшовся зі знімком', () => {
    expect(generateResult.stdout).toContain('No schema changes');
  });

  it('жодного НОВОГО файла міграції в копії не зʼявилось', () => {
    const sqlFiles = readdirSync(tmpDrizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(sqlFiles).toEqual(['0000_init.sql']);
  });
});

describe('парність джерел схеми: drizzle/0000_init.sql ↔ migrations/0001_init.sql', () => {
  it('канон ≡ вивід drizzle-kit після нормалізації й allowlist', () => {
    const drizzleLines = normalizeLines(
      readFileSync(resolve(REAL_DRIZZLE_DIR, '0000_init.sql'), 'utf8'),
    );
    const migrationLines = normalizeLines(
      readFileSync(REAL_MIGRATIONS_FILE, 'utf8'),
    );
    const migrationLinesWithoutAllowlist = migrationLines.filter(
      (line) => !ALLOWLIST_MIGRATION_ONLY_LINES.includes(line),
    );
    expect(migrationLinesWithoutAllowlist).toEqual(drizzleLines);
  });

  it('allowlist не містить мертвих записів — обидва рядки реально в каноні', () => {
    const migrationLines = normalizeLines(
      readFileSync(REAL_MIGRATIONS_FILE, 'utf8'),
    );
    for (const line of ALLOWLIST_MIGRATION_ONLY_LINES)
      expect(migrationLines, `рядок відсутній у каноні: ${line}`).toContain(
        line,
      );
  });
});
