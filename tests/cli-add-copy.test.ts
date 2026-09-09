import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  copyPreflight,
  copyThemeSources,
  mergeDependencies,
  runThemeCopy,
  themeSpec,
} from '../packages/cli/src/add-copy.mjs';

// simplycms add <pkg> --theme --copy (Фаза 4, Р5). Реального pnpm тут немає:
// сценарій приймає виконавця параметром, тож перевіряються і ПОРЯДОК команд
// (add → … → remove), і відкат при провалі валідації — без мережі й install.

const CONFIG = `import { defineConfig } from 'simplycms/runtime';

export default defineConfig({
  plugins: [],
  themes: {
    default: () => import('@themes/default/index'),
  },
});
`;

const THEME_MANIFEST = {
  name: '@acme/simplycms-theme-aurora',
  version: '1.0.0',
  dependencies: { '@simplycms/themes': '^0.3.0', 'aurora-charts': '^2.0.0' },
};

/** Магазин із фікстурним node_modules: пакет теми «вже встановлений». */
function makeStore({ withSrc = true } = {}) {
  const storeRoot = mkdtempSync(join(tmpdir(), 'cli-copy-'));
  writeFileSync(
    join(storeRoot, 'package.json'),
    `${JSON.stringify({ name: 's', dependencies: { '@simplycms/themes': '0.3.0' } }, null, 2)}\n`,
  );
  writeFileSync(join(storeRoot, 'simplycms.config.ts'), CONFIG);
  const pkgDir = join(storeRoot, 'node_modules/@acme/simplycms-theme-aurora');
  mkdirSync(join(pkgDir, 'src/components'), { recursive: true });
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(THEME_MANIFEST, null, 2),
  );
  if (withSrc) {
    writeFileSync(join(pkgDir, 'src/index.ts'), 'export default {};\n');
    writeFileSync(join(pkgDir, 'src/components/Header.tsx'), 'export {};\n');
  }
  writeFileSync(join(pkgDir, 'README.md'), '# aurora\n');
  return {
    storeRoot,
    pkgDir,
    configPath: join(storeRoot, 'simplycms.config.ts'),
  };
}

/**
 * Фейковий pnpm: журнал команд + ЗНІМОК залежностей магазину на момент кожної
 * з них. Знімок доводить саме ПОРЯДОК подій (deps теми влиті ДО `remove`) —
 * асерт по кінцевому стану манифесту доводив би лише ФАКТ злиття.
 */
function fakePnpm(storeRoot: string) {
  const calls: string[][] = [];
  const depsAt: string[][] = [];
  return {
    calls,
    depsAt,
    run: (args: string[]) => {
      calls.push(args);
      const manifest = JSON.parse(
        readFileSync(join(storeRoot, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };
      depsAt.push(Object.keys(manifest.dependencies ?? {}));
    },
  };
}

describe('add --copy: чисті частини', () => {
  it('copyPreflight: нема теки — proceed, тека+конфіг — done, тека без конфігу — помилка', () => {
    const { storeRoot } = makeStore();
    const source = readFileSync(join(storeRoot, 'simplycms.config.ts'), 'utf8');
    expect(copyPreflight({ storeRoot, key: 'aurora', source })).toBe('proceed');

    mkdirSync(join(storeRoot, 'themes/aurora'), { recursive: true });
    expect(() => copyPreflight({ storeRoot, key: 'aurora', source })).toThrow(
      /вже існує/,
    );

    const wired = source.replace(
      'themes: {',
      `themes: {\n    'aurora': () => import('${themeSpec('aurora')}'),`,
    );
    expect(copyPreflight({ storeRoot, key: 'aurora', source: wired })).toBe(
      'done',
    );
  });

  it('copyPreflight: ключ зайнятий npm-записом тієї ж теми — гучна помилка', () => {
    // Магазин уже поставив тему пакетом; --copy із тим самим ключем дописав би
    // ДРУГИЙ запис (TS1117), а фінальний remove зняв би пакет переможного
    // запису — «Готово» на битому білді. Теки themes/aurora ще немає.
    const { storeRoot } = makeStore();
    const npmWired = CONFIG.replace(
      'themes: {',
      "themes: {\n    'aurora': () => import('@acme/simplycms-theme-aurora'),",
    );
    expect(() =>
      copyPreflight({ storeRoot, key: 'aurora', source: npmWired }),
    ).toThrow(/--name/);
  });

  it('mergeDependencies: доливає лише те, чого магазин ще не має', () => {
    const { manifest, added } = mergeDependencies(
      {
        dependencies: { '@simplycms/themes': '0.3.0' },
        devDependencies: { vite: '8.0.0' },
      },
      {
        dependencies: { '@simplycms/themes': '^0.3.0', vite: '^8', zod: '^4' },
      },
    );
    expect(added).toEqual(['zod']);
    expect(manifest.dependencies).toEqual({
      '@simplycms/themes': '0.3.0',
      zod: '^4',
    });
  });

  it('copyThemeSources: src/* лягає в корінь теки теми, README — поруч', () => {
    const { pkgDir } = makeStore();
    const targetDir = join(
      mkdtempSync(join(tmpdir(), 'cli-copy-t-')),
      'aurora',
    );
    const copied = copyThemeSources({ pkgDir, targetDir });
    expect(copied).toEqual(['src/*', 'README.md']);
    expect(existsSync(join(targetDir, 'index.ts'))).toBe(true);
    expect(existsSync(join(targetDir, 'components/Header.tsx'))).toBe(true);
    expect(existsSync(join(targetDir, 'README.md'))).toBe(true);
  });
});

describe('add --copy: сценарій', () => {
  it('повний прохід: add → копія → конфіг → remove; deps теми перенесено', () => {
    const { storeRoot, configPath } = makeStore();
    const pnpm = fakePnpm(storeRoot);
    const report = runThemeCopy({
      storeRoot,
      configPath,
      pkg: '@acme/simplycms-theme-aurora',
      key: 'aurora',
      pnpm: pnpm.run,
    });

    expect(report.status).toBe('copied');
    expect(pnpm.calls).toEqual([
      ['add', '@acme/simplycms-theme-aurora'],
      ['remove', '@acme/simplycms-theme-aurora'],
    ]);
    expect(existsSync(join(storeRoot, 'themes/aurora/index.ts'))).toBe(true);
    // У конфізі — ЛОКАЛЬНИЙ специфікатор: імʼя пакета там не зʼявляється.
    const config = readFileSync(configPath, 'utf8');
    expect(config).toContain("'aurora': () => import('@themes/aurora/index')");
    expect(config).not.toContain('@acme/simplycms-theme-aurora');
    // Злиття deps — ДО remove, інакше замикання залежностей забрав би pnpm.
    // Доводить це знімок манифесту НА МОМЕНТ кожної команди, а не кінцевий стан.
    expect(pnpm.depsAt[0]).not.toContain('aurora-charts'); // на `add` — ще ні
    expect(pnpm.depsAt[1]).toContain('aurora-charts'); // на `remove` — уже влито
    const manifest = JSON.parse(
      readFileSync(join(storeRoot, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['aurora-charts']).toBe('^2.0.0');
    expect(report.added).toEqual(['aurora-charts']);
  });

  it('повторний запуск — ідемпотентний: жодної команди pnpm', () => {
    const { storeRoot, configPath } = makeStore();
    const first = fakePnpm(storeRoot);
    runThemeCopy({
      storeRoot,
      configPath,
      pkg: '@acme/simplycms-theme-aurora',
      key: 'aurora',
      pnpm: first.run,
    });
    const second = fakePnpm(storeRoot);
    const report = runThemeCopy({
      storeRoot,
      configPath,
      pkg: '@acme/simplycms-theme-aurora',
      key: 'aurora',
      pnpm: second.run,
    });
    expect(report.status).toBe('done');
    expect(second.calls).toEqual([]);
  });

  it('пакет без src/index.ts — помилка з відкотом pnpm remove', () => {
    const { storeRoot, configPath } = makeStore({ withSrc: false });
    const pnpm = fakePnpm(storeRoot);
    expect(() =>
      runThemeCopy({
        storeRoot,
        configPath,
        pkg: '@acme/simplycms-theme-aurora',
        key: 'aurora',
        pnpm: pnpm.run,
      }),
    ).toThrow(/src\/index\.ts/);
    expect(pnpm.calls).toEqual([
      ['add', '@acme/simplycms-theme-aurora'],
      ['remove', '@acme/simplycms-theme-aurora'],
    ]);
    // Магазин лишився як був: ні теки теми, ні запису в конфізі.
    expect(existsSync(join(storeRoot, 'themes/aurora'))).toBe(false);
    expect(readFileSync(configPath, 'utf8')).toBe(CONFIG);
  });

  it('--dry-run: ані pnpm, ані запису на диск', () => {
    const { storeRoot, configPath } = makeStore();
    const pnpm = fakePnpm(storeRoot);
    const report = runThemeCopy({
      storeRoot,
      configPath,
      pkg: '@acme/simplycms-theme-aurora',
      key: 'aurora',
      dryRun: true,
      pnpm: pnpm.run,
    });
    expect(report.status).toBe('dry-run');
    expect(report.line).toContain("import('@themes/aurora/index')");
    expect(pnpm.calls).toEqual([]);
    expect(existsSync(join(storeRoot, 'themes/aurora'))).toBe(false);
    expect(readFileSync(configPath, 'utf8')).toBe(CONFIG);
  });

  it('колізія теки: помилка ДО будь-якої дії', () => {
    const { storeRoot, configPath } = makeStore();
    mkdirSync(join(storeRoot, 'themes/aurora'), { recursive: true });
    const pnpm = fakePnpm(storeRoot);
    expect(() =>
      runThemeCopy({
        storeRoot,
        configPath,
        pkg: '@acme/simplycms-theme-aurora',
        key: 'aurora',
        pnpm: pnpm.run,
      }),
    ).toThrow(/Нічого не змінено/);
    expect(pnpm.calls).toEqual([]);
  });

  it('колізія КЛЮЧА (тема вже стоїть пакетом): помилка ДО будь-якої дії', () => {
    const { storeRoot, configPath } = makeStore();
    const npmWired = CONFIG.replace(
      'themes: {',
      "themes: {\n    'aurora': () => import('@acme/simplycms-theme-aurora'),",
    );
    writeFileSync(configPath, npmWired);
    const pnpm = fakePnpm(storeRoot);
    expect(() =>
      runThemeCopy({
        storeRoot,
        configPath,
        pkg: '@acme/simplycms-theme-aurora',
        key: 'aurora',
        pnpm: pnpm.run,
      }),
    ).toThrow(/--name/);
    expect(pnpm.calls).toEqual([]);
    expect(existsSync(join(storeRoot, 'themes/aurora'))).toBe(false);
    expect(readFileSync(configPath, 'utf8')).toBe(npmWired);
  });
});
