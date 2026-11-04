import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gateBundle } from '../scripts/pilot-pack/gate-c.mjs';

/**
 * Незалежний контроль Gate C (`bundle-guard + code splitting` пілота).
 *
 * 🔴 Gate C до цього доводився лише живим `pilot:pack`; тут він ганяється на
 * синтетичному `bundle-stats.client.json`, тож регрес його списків
 * (`SERVER_PAYLOAD`, `NOT_IN_INITIAL`) червонить юніт-сюїту, а не тихо
 * зеленіє. Кожен чанк фікстури має всі три поля `modules/isEntry/imports` —
 * `initialChunks` читає останні два, без них перевірка `NOT_IN_INITIAL`
 * вакуумна або падає.
 */

type Chunk = { modules: string[]; isEntry: boolean; imports: string[] };

const NM = '/store/node_modules';
const FN_STUB = `${NM}/simplycms/dist/storefront-routes/server/x.js`;
const ADMIN_STUB = `${NM}/simplycms/dist/admin-server/index.js`;

let store: string;

beforeEach(() => {
  store = mkdtempSync(join(tmpdir(), 'gate-c-'));
  // `gateBundle` перевіряє пару index.js + impl/index.js встановленого пакета.
  for (const rel of ['index.js', 'impl/index.js']) {
    const file = join(store, 'node_modules/simplycms/dist/admin-server', rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '');
  }
});

afterEach(() => {
  rmSync(store, { recursive: true, force: true });
});

/** Ліниві каталоги ядра: чанки `base-<хеш>`, досяжні лише через `import()`. */
const CATALOG_BASE = `${NM}/simplycms/dist/base-C2UX6O0_.js`;
const LAZY_CATALOGS: Record<string, Chunk> = {
  'base.js': { modules: [CATALOG_BASE], isEntry: false, imports: [] },
};

const run = (stats: Record<string, Chunk>) => {
  stats = { ...LAZY_CATALOGS, ...stats };
  writeFileSync(join(store, 'bundle-stats.client.json'), JSON.stringify(stats));
  return gateBundle(store);
};

/** Entry-чанк із заглушками server-fn і admin-server — «чистий» базис. */
const entry = (extra: string[] = []): Chunk => ({
  modules: [FN_STUB, ADMIN_STUB, ...extra],
  isEntry: true,
  imports: [],
});

describe('Gate C: серверний вантаж у клієнтському бандлі', () => {
  it('чистий набір (заглушки server-fn і admin-server) проходить', () => {
    expect(run({ 'entry.js': entry() }).ok).toBe(true);
  });

  it('модуль db-рантайму ядра у клієнті — FAIL із точним рядком і шляхом модуля', () => {
    const leaked = `${NM}/simplycms/dist/db/client.js`;
    const result = run({ 'entry.js': entry([leaked]) });
    expect(result.ok).toBe(false);
    // Повний FAIL-рядок gateBundle, а не підрядок `db`: той збігся б з будь-яким
    // шляхом чи словом у details і не ловив би випадіння db з SERVER_ONLY.
    expect(result.details).toContain(
      `FAIL серверний вантаж у клієнті: ${leaked}`,
    );
  });

  it('drizzle-orm у клієнті — FAIL', () => {
    const result = run({
      'entry.js': entry([`${NM}/drizzle-orm/index.js`]),
    });
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toContain('drizzle-orm');
  });
});

describe('Gate C: важкі підсистеми поза initial-чанком', () => {
  const ADMIN_MODULE = `${NM}/simplycms/dist/admin/x.js`;

  it('admin у чанку, статично імпортованому з entry — FAIL (NOT_IN_INITIAL)', () => {
    const result = run({
      'entry.js': { ...entry(), imports: ['admin.js'] },
      'admin.js': { modules: [ADMIN_MODULE], isEntry: false, imports: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toMatch(/FAIL simplycms\/admin/);
  });

  it('той самий модуль у чанку, досяжному лише динамічно, — OK', () => {
    // `admin.js` відсутній у `imports` entry: до нього веде лише import().
    const result = run({
      'entry.js': entry(),
      'admin.js': { modules: [ADMIN_MODULE], isEntry: false, imports: [] },
    });
    expect(result.ok).toBe(true);
  });
});

describe('Gate C: каталоги ядра лише через import() (І43)', () => {
  const ADMIN_CATALOG = `${NM}/simplycms/dist/admin-BcKAsf47.js`;

  it('чанк каталогу, статично імпортований з entry, — FAIL', () => {
    const result = run({
      'entry.js': { ...entry(), imports: ['base.js'] },
    });
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toMatch(/FAIL каталоги ядра/);
  });

  it('каталог частини admin у статичному графі entry — FAIL', () => {
    const result = run({
      'entry.js': { ...entry(), imports: ['admin.js'] },
      'admin.js': { modules: [ADMIN_CATALOG], isEntry: false, imports: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('форма теками (i18n/catalogs) ловиться так само', () => {
    const result = run({
      'entry.js': entry([`${NM}/simplycms/dist/i18n/catalogs/en/base.js`]),
    });
    expect(result.ok).toBe(false);
  });

  it('чанк `admin-error-<хеш>` — не каталог', () => {
    const result = run({
      'entry.js': entry([`${NM}/simplycms/dist/admin-error-DI5_n184.js`]),
    });
    expect(result.ok).toBe(true);
  });

  it('жодного каталогу в бандлі (зламана назва чанка) — FAIL, а не вакуумний OK', () => {
    writeFileSync(
      join(store, 'bundle-stats.client.json'),
      JSON.stringify({ 'entry.js': entry() }),
    );
    const result = gateBundle(store);
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toMatch(
      /FAIL каталоги ядра .*: у бандлі 0/,
    );
  });
});
