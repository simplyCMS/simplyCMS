import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_SOURCE_DIR,
  CLI_HOST_DIR,
  SCHEMA_MIGRATIONS_DIR,
  SYNCED_DIRS,
  SYNCED_FILES,
  TEMPLATE_DIR,
  TEMPLATE_HOST_FILES,
} from '../scripts/sync-create-store-template.mjs';
import { ENV_PLACEHOLDERS } from '../packages/cli/src/env-placeholders.mjs';
import { BUNDLED_SKILLS } from '../packages/create-simplycms-store/src/skill-links.mjs';

// Шаблон create-simplycms-store — генерат: дрейф із монорепо лагодиться
// `pnpm template:sync`, а не руками (парність копії з джерелом стереже цей тест).
const read = (p: string) => readFileSync(p, 'utf8');

/** Рекурсивний перелік файлів теки, шляхи — відносні до неї, відсортовані. */
const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();

describe('create-store template: парність із монорепо', () => {
  it.each(SYNCED_FILES)('host-файл %s байт-ідентичний', (file) => {
    expect(read(join(TEMPLATE_DIR, file))).toBe(read(file));
  });

  it.each(SYNCED_DIRS.map((d) => [d.from, d.to, d.exclude ?? []] as const))(
    'тека %s байт-ідентична',
    (from, to, exclude) => {
      // `exclude` — файли, що свідомо НЕ їдуть у шаблон (напр. removed.json).
      const source = listFiles(from).filter((file) => !exclude.includes(file));
      expect(source.length).toBeGreaterThan(0);
      expect(listFiles(join(TEMPLATE_DIR, to))).toEqual(source);
      for (const file of source) {
        expect(read(join(TEMPLATE_DIR, to, file))).toBe(read(join(from, file)));
      }
    },
  );

  // Е8-Р5: CLAUDE.md шаблону — генерат із вступу ядра (блок AGENTS.md стереже
  // managed-block.test.ts тією самою функцією рендеру, що й update).
  it('CLAUDE.md шаблону байт-ідентичний agent/claude-md.md і імпортує AGENTS.md', () => {
    const claude = read(join(TEMPLATE_DIR, 'CLAUDE.md'));
    expect(claude).toBe(read(join(AGENT_SOURCE_DIR, 'claude-md.md')));
    expect(claude.split('\n')[0]).toBe('@AGENTS.md');
  });

  // Дзеркала §5 спеки CLI v1: ті самі джерела, той самий `pnpm template:sync`.
  // Канон host/ пакета CLI — джерело `simplycms update`; тека сама собі
  // маніфест, тож окрім вмісту стережемо і точний склад (зайвий чи застарілий
  // файл у каноні — теж дрейф).
  it.each(SYNCED_FILES)('канон host/ CLI: %s байт-ідентичний', (file) => {
    expect(read(join(CLI_HOST_DIR, file))).toBe(read(file));
  });

  // Файли, чиє джерело — сам шаблон (шим хука): канон host/ несе їхню байт-копію.
  it.each(TEMPLATE_HOST_FILES)(
    'канон host/ CLI: %s = копія шаблону',
    (file) => {
      expect(read(join(CLI_HOST_DIR, file))).toBe(
        read(join(TEMPLATE_DIR, file)),
      );
    },
  );

  it('канон host/ CLI складається рівно з SYNCED_FILES і файлів шаблону', () => {
    expect(listFiles(CLI_HOST_DIR)).toEqual(
      [...SYNCED_FILES, ...TEMPLATE_HOST_FILES].sort(),
    );
  });

  // Канон міграцій ядра (B13) — baseline + сід, а не історія з 33 файлів.
  // Склад асертиться ТОЧНО, а не порогом: порядок накату задає саме імʼя
  // файлу, тож зайвий чи перейменований файл — це зламаний накат на чисту БД,
  // а не «дрібний дрейф». Копію в шаблоні стереже перевірка SYNCED_DIRS вище.
  // 🔴 `demo/demo-seed.sql` тут теж є, але НЕ входить у канон: readdir у
  // каноні (`db-diff.mjs`, `apply.mjs`) нерекурсивний і бере лише `*.sql`
  // верхнього рівня, тож піддиректорія `demo/` для накату канону невидима.
  it('канон міграцій ядра — 0000_prelude → 0004_functions + README + demo/ + removed.json', () => {
    expect(listFiles(SCHEMA_MIGRATIONS_DIR)).toEqual([
      '0000_prelude.sql',
      '0001_init.sql',
      '0002_grants.sql',
      '0003_seed.sql',
      '0004_functions.sql',
      'README.md',
      'demo/demo-seed.sql',
      'removed.json',
    ]);
  });

  // Маніфест читає CLI з установленого ядра; у `db/migrations` магазину він був
  // би чужорідним файлом поруч із міграціями (див. SYNCED_DIRS).
  it('removed.json у шаблон магазину не їде', () => {
    expect(listFiles(join(TEMPLATE_DIR, 'db/migrations'))).not.toContain(
      'removed.json',
    );
  });

  // 🔴 Схеми стороннього сервісу автентифікації й сховища у baseline не існують як клас — це і
  // є доказ B13 на рівні дефолтного гейта (`pnpm test`, без БД). Поведінковий
  // доказ — накат на харнес у `pnpm test:schema`.
  it('канон не згадує auth.* / storage.*', () => {
    for (const file of listFiles(SCHEMA_MIGRATIONS_DIR).filter((f) =>
      f.endsWith('.sql'),
    )) {
      const sql = read(join(SCHEMA_MIGRATIONS_DIR, file)).replace(
        /--[^\n]*/g,
        '',
      );
      expect(sql).not.toMatch(/\bauth\./);
      expect(sql).not.toMatch(/\bstorage\./);
    }
  });

  // Пілотний оверлей — форк шаблонного `vite.config.ts` (плюс `emitBundleStats`
  // для Gate C). Без цього гарда пілот збирав би скретч НЕ тим конфігом, який
  // отримує користувач, і дрейф шаблону лишався б невидимим.
  it('vite.config.ts пілота = шаблонний + блоки #region pilot-only', () => {
    const stripPilotOnly = (source: string) =>
      source.replace(
        /^[ \t]*\/\/ #region pilot-only\n[\s\S]*?^[ \t]*\/\/ #endregion pilot-only\n/gm,
        '',
      );
    const overlay = read('tests/pilot/store-template/vite.config.ts');
    // Маркери мають бути парними й реально знайденими — інакше «парність»
    // зійшлася б просто тому, що вирізати не було чого. Рахуємо лише
    // маркери-РЯДКИ: згадка `#region` у прозі коментаря — не маркер.
    const count = (re: RegExp) => (overlay.match(re) ?? []).length;
    const opened = count(/^[ \t]*\/\/ #region pilot-only$/gm);
    expect(opened).toBeGreaterThan(0);
    expect(count(/^[ \t]*\/\/ #endregion pilot-only$/gm)).toBe(opened);
    expect(overlay).toContain('emitBundleStats');
    const stripped = stripPilotOnly(overlay);
    expect(stripped).not.toContain('emitBundleStats');
    expect(stripped).toBe(read(join(TEMPLATE_DIR, 'vite.config.ts')));
  });

  // 🔴 `packageManager` визначає, ЯКИМ pnpm ставиться скретч: corepack бере
  // поле з найближчого package.json, а оверлей затирає шаблонний манифест.
  // Заміряно на цій машині: у теці з полем — pnpm 11.20.0, без нього — 10.33.0.
  // Різниця смислова, а не косметична: pnpm 10 ще читає поле `pnpm` у
  // package.json, pnpm 11 уже ні — тобто помилкова форма overrides пройшла б
  // зелено на 10 і зламалась би в користувача на 11.
  it('пілот ставить скретч тим самим pnpm, що й шаблон', () => {
    const tpl = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl'))
        .replaceAll('__SIMPLYCMS_VERSION__', '0.0.0')
        .replaceAll('__STORE_NAME__', 'x'),
    );
    const pilot = JSON.parse(read('tests/pilot/store-template/package.json'));
    expect(tpl.packageManager).toMatch(/^pnpm@11\./);
    expect(pilot.packageManager).toBe(tpl.packageManager);
  });

  // 🔴 npm-івський top-level `overrides` pnpm ігнорує МОВЧКИ — нуль
  // попереджень. Повернення цієї форми не впало б на прогоні, а тихо зняло б
  // підстановку tarball-ів, і пілот перевіряв би опубліковані пакети замість
  // тих, що йдуть на публікацію. Місце overrides — `pnpm-workspace.yaml`
  // скретча (дописує scaffold.mjs).
  it('оверлей не несе npm-івського overrides', () => {
    const pilot = JSON.parse(read('tests/pilot/store-template/package.json'));
    expect(pilot.overrides).toBeUndefined();
  });

  it('deps шаблону і пілот-фікстури не розійшлися', () => {
    const tpl = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl'))
        .replaceAll('__SIMPLYCMS_VERSION__', '0.0.0')
        .replaceAll('__STORE_NAME__', 'x'),
    );
    const pilot = JSON.parse(read('tests/pilot/store-template/package.json'));
    expect(Object.keys(tpl.dependencies).sort()).toEqual(
      Object.keys(pilot.dependencies).sort(),
    );
    expect(Object.keys(tpl.devDependencies).sort()).toEqual(
      Object.keys(pilot.devDependencies).sort(),
    );
  });

  // 🔴 Топологія 5 (трек К0): магазин ставить ОДИН пакет ядра — unscoped
  // `simplycms`. Будь-який `@simplycms/*` у dependencies шаблону означає,
  // що злитий пакет ожив рукою: install дав би два інстанси ядра.
  it('deps шаблону — рівно один пакет ядра, unscoped simplycms', () => {
    const tpl = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl'))
        .replaceAll('__SIMPLYCMS_VERSION__', '0.0.0')
        .replaceAll('__STORE_NAME__', 'x'),
    );
    expect(tpl.dependencies.simplycms).toBe('0.0.0');
    expect(
      Object.keys(tpl.dependencies).filter((name) =>
        name.startsWith('@simplycms/'),
      ),
    ).toEqual([]);
    // ПК7: FAQ — референс-плагін, а не частина стартового магазину.
    expect(tpl.dependencies['@simplycms/plugin-faq']).toBeUndefined();
    expect(read(join(TEMPLATE_DIR, 'simplycms.config.ts'))).not.toContain(
      'plugin-faq',
    );
    // CLI лишається scoped-сателітом і живе в devDependencies.
    expect(tpl.devDependencies['@simplycms/cli']).toBe('0.0.0');
  });

  // routes.ts магазину монтує роут-теки ОДНОГО пакета підшляхами, а не два
  // окремі route-пакети; `realpathSync` лишається (без нього роути мовчки
  // втрачають code-splitting).
  it('routes.ts шаблону монтує simplycms/routes/{storefront,admin}', () => {
    const source = read(join(TEMPLATE_DIR, 'routes.ts'));
    expect(source).toContain('realpathSync');
    expect(source).toContain("'simplycms'");
    expect(source).toContain("coreRoutes('storefront')");
    expect(source).toContain("coreRoutes('admin')");
    expect(source).not.toContain('@simplycms/storefront-routes');
    expect(source).not.toContain('@simplycms/admin-routes');
    expect(source).not.toContain('plugin-faq');
  });

  // Tailwind магазину має бачити класи ядра з ОДНОГО пакета; scoped-глоби
  // лишаються — ними живуть npm-теми й плагіни сателітів і сторонніх.
  it('tailwind.config.ts шаблону сканує dist і routes пакета simplycms', () => {
    const source = read(join(TEMPLATE_DIR, 'tailwind.config.ts'));
    expect(source).toContain('./node_modules/simplycms/dist/**/*.js');
    expect(source).toContain('./node_modules/simplycms/routes/**/*.{ts,tsx}');
    expect(source).toContain('./node_modules/@simplycms/*/dist/**/*.js');
  });

  // Скіли їдуть у магазин СИМЛІНКАМИ на `node_modules/simplycms/skills/`
  // (створює скаффолдер, лагодить `simplycms update`) — копії в шаблоні
  // більше немає, інакше магазин ніс би форк скіла, що старіє мовчки.
  it('шаблон не несе копії скілів', () => {
    // `.claude/` у шаблоні є (хук і його шим), тож копією скілів вважаємо лише `skills/`.
    expect(existsSync(join(TEMPLATE_DIR, '.claude/skills'))).toBe(false);
    expect(existsSync(join(TEMPLATE_DIR, '.agents/skills'))).toBe(false);
    expect(SYNCED_DIRS.some(({ to }) => to.includes('skills'))).toBe(false);
  });

  // Список скілів у скаффолдері — резерв на випадок «install пропущено»
  // (теки node_modules ще немає, а лінк створюється наперед). Дрейф проти
  // теки пакета зробив би резерв мовчки неповним.
  it('BUNDLED_SKILLS скаффолдера збігається зі skills/ пакета', () => {
    const packaged = readdirSync('packages/simplycms/skills', {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(packaged.length).toBeGreaterThan(0);
    expect([...BUNDLED_SKILLS].sort()).toEqual(packaged);
  });

  // Р28(в): заглушка в прикладі «працює» як значення. Список — той самий, що
  // читає doctor; шукаємо у всьому файлі, включно із закоментованими рядками.
  it('env.example не містить жодного значення зі списку заглушок', () => {
    const example = read(join(TEMPLATE_DIR, 'env.example'));
    const values = Object.values(ENV_PLACEHOLDERS).flat();
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(example).not.toContain(value);
  });

  // Р28(а): єдиний прод-старт — `node scripts/start.mjs`; `pnpm start`
  // лишається локальним запуском бандла.
  it('package.json.tpl: немає start:prod, start лишається локальним server.mjs', () => {
    const scripts = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl')).replaceAll(
        '__SIMPLYCMS_VERSION__',
        '1.0.0',
      ),
    ).scripts;
    expect(scripts['start:prod']).toBeUndefined();
    expect(scripts.start).toBe('node server.mjs');
  });

  it('gitignore шаблону ігнорує tmp атомарного запису deploy.json', () => {
    const lines = read(join(TEMPLATE_DIR, 'gitignore')).split('\n');
    expect(lines).toContain('.simplycms/*.tmp');
    expect(lines).not.toContain('.simplycms/');
  });

  it('README шаблону: прод-рецепт — node scripts/start.mjs, pnpm start позначений «не для проду»', () => {
    const readme = read(join(TEMPLATE_DIR, 'README.md'));
    expect(readme).toContain('node scripts/start.mjs');
    expect(readme).toMatch(/pnpm start[^\n]*\n?[^\n]*не для проду/);
    expect(readme).not.toContain('start:prod');
  });
});
