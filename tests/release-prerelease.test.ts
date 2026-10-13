import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  assertNewerVersion,
  bumpTo,
  compareVersions,
  VERSION_RE,
} from '../scripts/release/bump.mjs';
import { distTagFor } from '../scripts/release/dist-tag.mjs';
import { compareVersions as cliCompareVersions } from '../packages/cli/src/versions.mjs';
import { readCliVersion } from '../packages/cli/src/context.mjs';

// Пререлізний цикл 1.0.0-rc.N (T16): форма версії, порядок, бамп, npm-тег.
const REPO = resolve('.');

describe('VERSION_RE', () => {
  it.each(['1.0.0-rc.1', '1.0.0', '1.0.0-rc.0', '0.14.0'])(
    'приймає %s',
    (v) => {
      expect(VERSION_RE.test(v)).toBe(true);
    },
  );
  it.each(['1.0.0-beta.1', '1.0.0-rc', '1.0.0-rc.01', '1.0.0-rc.', '1.0'])(
    'відкидає %s',
    (v) => {
      expect(VERSION_RE.test(v)).toBe(false);
    },
  );
});

const CHAIN = [
  '0.14.0',
  '1.0.0-rc.1',
  '1.0.0-rc.2',
  '1.0.0-rc.10',
  '1.0.0',
  '1.0.1',
];

describe('compareVersions', () => {
  it('ланцюг 0.14.0 < rc.1 < rc.2 < rc.10 < 1.0.0 < 1.0.1', () => {
    for (let i = 0; i < CHAIN.length; i += 1) {
      for (let j = 0; j < CHAIN.length; j += 1) {
        expect(compareVersions(CHAIN[i], CHAIN[j])).toBe(Math.sign(i - j));
      }
    }
  });

  it('паритет із вбудованою копією CLI (simplycms update)', () => {
    for (const a of CHAIN) {
      for (const b of CHAIN) {
        expect(cliCompareVersions(a, b)).toBe(compareVersions(a, b));
      }
    }
  });
});

describe('assertNewerVersion', () => {
  it.each([
    ['1.0.0-rc.1', '0.14.0'],
    ['1.0.0', '1.0.0-rc.3'],
  ])('%s після %s — ок', (next, current) => {
    expect(() => assertNewerVersion(next, current)).not.toThrow();
  });
  it.each([
    ['1.0.0-rc.1', '1.0.0'],
    ['1.0.0-rc.1', '1.0.0-rc.1'],
  ])('%s після %s — відмова', (next, current) => {
    expect(() => assertNewerVersion(next, current)).toThrow(/не більша/);
  });

  it('release.mjs імпортує й кличе assertNewerVersion, а не власне порівняння', () => {
    const source = readFileSync('scripts/release.mjs', 'utf8');
    expect(source).toMatch(
      /import\s*\{[^}]*\bassertNewerVersion\b[^}]*\}\s*from\s*'\.\/release\/bump\.mjs'/,
    );
    expect(source).toMatch(/assertNewerVersion\(\s*version\s*,\s*from\s*\)/);
    expect(source).not.toMatch(/compareVersions/);
    expect(source).toContain('X.Y.Z-rc.N');
  });
});

describe('bumpTo(RC) на фікстурі', () => {
  const cwd = process.cwd();
  afterEach(() => process.chdir(cwd));

  it('CORE_VERSION, package.json і маніфести: version і engines ^1.0.0-0', () => {
    const root = mkdtempSync(join(tmpdir(), 'bump-rc-'));
    const pkg = (dir: string, extra: object = {}) => {
      mkdirSync(join(root, 'packages', dir), { recursive: true });
      writeFileSync(
        join(root, 'packages', dir, 'package.json'),
        JSON.stringify({ name: dir, version: '0.14.0', ...extra }),
      );
    };
    pkg('simplycms');
    pkg('simplycms-plugin-faq');
    const versionTs = join(
      root,
      'packages/simplycms/src/contracts/semver/version.ts',
    );
    mkdirSync(join(root, 'packages/simplycms/src/contracts/semver'), {
      recursive: true,
    });
    writeFileSync(versionTs, "export const CORE_VERSION = '0.14.0';\n");
    mkdirSync(join(root, 'packages/simplycms-plugin-faq/src'), {
      recursive: true,
    });
    const manifest = join(root, 'packages/simplycms-plugin-faq/src/index.ts');
    writeFileSync(
      manifest,
      "export default {\n  version: '0.14.0',\n  engines: { simplycms: '>=0.3.0' },\n};\n",
    );

    process.chdir(root);
    bumpTo('1.0.0-rc.1');
    expect(readFileSync(versionTs, 'utf8')).toContain(
      "CORE_VERSION = '1.0.0-rc.1'",
    );
    const source = readFileSync(manifest, 'utf8');
    expect(source).toContain("version: '1.0.0-rc.1',");
    expect(source).toContain("engines: { simplycms: '^1.0.0-0' },");
    // Фінальний 1.0.0 після RC: літерали вже RC, але діапазон і версія оновлюються.
    bumpTo('1.0.0');
    const final = readFileSync(manifest, 'utf8');
    expect(final).toContain("version: '1.0.0',");
    expect(final).toContain("engines: { simplycms: '^1.0.0' },");
  });
});

describe('distTagFor', () => {
  it('пре-реліз → next, стабільний → latest', () => {
    expect(distTagFor('1.0.0-rc.1')).toBe('next');
    expect(distTagFor('1.0.0')).toBe('latest');
    expect(distTagFor('0.14.0')).toBe('latest');
  });

  it('dist-tag.mjs --print на фікстурі з RC-версією друкує next', () => {
    const root = mkdtempSync(join(tmpdir(), 'dist-tag-'));
    mkdirSync(join(root, 'packages', 'simplycms'), { recursive: true });
    writeFileSync(
      join(root, 'packages', 'simplycms', 'package.json'),
      JSON.stringify({ name: 'simplycms', version: '1.0.0-rc.1' }),
    );
    const out = execFileSync(
      process.execPath,
      [join(REPO, 'scripts/release/dist-tag.mjs'), '--print'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(out.trim()).toBe('next');
  });
});

describe('workflow publish-packages: тег публікації', () => {
  type Step = { name?: string; run?: string };
  const workflow = parseYaml(
    readFileSync('.github/workflows/publish-packages.yml', 'utf8'),
  ) as { jobs: Record<string, { steps: Step[] }> };
  const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);

  it('рівно один виклик pnpm publish — у кроці Publish — з --tag від dist-tag.mjs', () => {
    const publishing = steps.filter((s) =>
      /pnpm\s+publish\b/.test(s.run ?? ''),
    );
    expect(publishing).toHaveLength(1);
    expect(publishing[0].name).toBe('Publish');
    expect(publishing[0].run).toContain(
      '--tag "$(node scripts/release/dist-tag.mjs --print)"',
    );
  });
});

describe('скаффолдер: версія RC', () => {
  it('create-simplycms-store/src/index.mjs бере версію з власного package.json', () => {
    const source = readFileSync(
      'packages/create-simplycms-store/src/index.mjs',
      'utf8',
    );
    expect(source).toMatch(/JSON\.parse\(readFileSync\(PACKAGE_JSON/);
    expect(source).toMatch(/version:\s*readVersion\(\)/);
  });

  it('піднятий з тегу next пакет (RC у package.json) дає магазину пін RC', () => {
    const work = mkdtempSync(join(tmpdir(), 'create-rc-'));
    const pkgDir = join(work, 'pkg');
    mkdirSync(pkgDir);
    cpSync('packages/create-simplycms-store/src', join(pkgDir, 'src'), {
      recursive: true,
    });
    cpSync(
      'packages/create-simplycms-store/template',
      join(pkgDir, 'template'),
      {
        recursive: true,
      },
    );
    const manifest = JSON.parse(
      readFileSync('packages/create-simplycms-store/package.json', 'utf8'),
    );
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ ...manifest, version: '1.0.0-rc.1' }),
    );
    // Залежності скаффолдера (clack) — з монорепо.
    cpSync(
      'packages/create-simplycms-store/node_modules',
      join(pkgDir, 'node_modules'),
      { recursive: true, dereference: true },
    );
    const target = join(work, 'shop');
    execFileSync(
      process.execPath,
      [
        join(pkgDir, 'src/index.mjs'),
        target,
        '--no-install',
        '--no-git',
        '--yes',
        '--database-url',
        'postgresql://app_runtime:pw@localhost:5432/postgres',
      ],
      { cwd: work, encoding: 'utf8', stdio: 'pipe' },
    );
    const store = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    );
    expect(store.dependencies.simplycms).toBe('1.0.0-rc.1');
  });
});

describe('CLI версії', () => {
  it('readCliVersion — версія власного package.json (і RC теж)', () => {
    expect(readCliVersion()).toMatch(VERSION_RE);
  });
});
