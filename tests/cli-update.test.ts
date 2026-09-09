import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findHostDrift,
  listFiles,
  writeHostFiles,
} from '../packages/cli/src/host-drift.mjs';
import {
  inspectSkillLinks,
  reconcileSkillLinks,
} from '../packages/cli/src/skill-links.mjs';
import {
  hostDriftExitCode,
  parseUpdateArgs,
  planCoreInstall,
  resolveTargetVersion,
} from '../packages/cli/src/update.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// simplycms update (§4.3): версійна логіка — чистими функціями без мережі,
// дрейф host-файлів — на реальному скаффолді шаблону зі штучним каноном у tmp.
async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-upd-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

/** Штучний канон: плаский і вкладений файли магазину, шляхи збережені. */
function makeCanon(store: string) {
  const hostDir = mkdtempSync(join(tmpdir(), 'cli-upd-canon-'));
  for (const file of ['server.mjs', 'src/router.tsx']) {
    mkdirSync(join(hostDir, 'src'), { recursive: true });
    cpSync(join(store, file), join(hostDir, file));
  }
  return hostDir;
}

describe('cli update', () => {
  it('parseUpdateArgs: дефолт --check, повний набір, гучні помилки', () => {
    expect(parseUpdateArgs([])).toEqual({
      write: false,
      install: true,
      to: undefined,
    });
    expect(
      parseUpdateArgs(['--write', '--to', '0.4.0', '--no-install']),
    ).toEqual({ write: true, install: false, to: '0.4.0' });
    expect(parseUpdateArgs(['--check'])).toEqual({
      write: false,
      install: true,
      to: undefined,
    });
    expect(() => parseUpdateArgs(['--check', '--write'])).toThrow(
      /взаємовиключні/,
    );
    expect(() => parseUpdateArgs(['--to'])).toThrow(/--to потребує значення/);
    expect(() => parseUpdateArgs(['--to', '--write'])).toThrow(
      /--to потребує значення/,
    );
    expect(() => parseUpdateArgs(['--wat'])).toThrow(/--wat/);
  });

  it('resolveTargetVersion: --to як є; реєстр — лише без --to, відповідь тримається', () => {
    const neverCalled = () => {
      throw new Error('не мав викликатися');
    };
    expect(resolveTargetVersion('0.4.0', neverCalled)).toBe('0.4.0');
    expect(resolveTargetVersion(undefined, () => '0.5.0\n')).toBe('0.5.0');
  });

  it('resolveTargetVersion: реєстр недоступний або мовчить — падіння з підказкою --to', () => {
    const offline = () => {
      throw new Error('ENOTFOUND registry.npmjs.org');
    };
    expect(() => resolveTargetVersion(undefined, offline)).toThrow(/--to/);
    expect(() => resolveTargetVersion(undefined, () => '')).toThrow(/--to/);
  });

  it('planCoreInstall: ядро + сателіти, deps і devDeps окремо, на цільову версію', () => {
    const manifest = {
      dependencies: {
        simplycms: '0.3.0',
        '@simplycms/theme-solarstore': '0.3.0',
        // 🔴 Стороння тема лише схожа іменем — оновлювати її версією ядра не
        // можна: у неї власний реліз-цикл.
        'simplycms-theme-aurora': '1.2.0',
        react: '19.0.0',
      },
      devDependencies: { '@simplycms/cli': '0.3.0', typescript: '5.9.0' },
    };
    expect(planCoreInstall(manifest, '0.4.0')).toEqual({
      deps: ['@simplycms/theme-solarstore@0.4.0', 'simplycms@0.4.0'],
      devDeps: ['@simplycms/cli@0.4.0'],
    });
    // Манифест без devDependencies — порожній план, а не падіння.
    expect(
      planCoreInstall({ dependencies: { react: '19.0.0' } }, '1.0.0'),
    ).toEqual({ deps: [], devDeps: [] });
  });

  it('findHostDrift: чистий скаффолд без дрейфу; правка і видалення — дрейф', async () => {
    const store = await scaffoldStore('upd-drift');
    const hostDir = makeCanon(store);
    expect(findHostDrift(store, hostDir)).toEqual({
      files: ['server.mjs', 'src/router.tsx'],
      drifted: [],
    });
    appendFileSync(join(store, 'server.mjs'), '\n// локальна правка\n');
    rmSync(join(store, 'src/router.tsx'));
    expect(findHostDrift(store, hostDir).drifted).toEqual([
      'server.mjs',
      'src/router.tsx',
    ]);
  });

  it('writeHostFiles: перезапис канонічними версіями закриває дрейф байт-у-байт', async () => {
    const store = await scaffoldStore('upd-write');
    const hostDir = makeCanon(store);
    appendFileSync(join(store, 'server.mjs'), '\n// дрейф\n');
    rmSync(join(store, 'src/router.tsx'));
    const { drifted } = findHostDrift(store, hostDir);
    writeHostFiles(store, drifted, hostDir);
    expect(findHostDrift(store, hostDir).drifted).toEqual([]);
    for (const file of ['server.mjs', 'src/router.tsx']) {
      expect(readFileSync(join(store, file), 'utf8')).toBe(
        readFileSync(join(hostDir, file), 'utf8'),
      );
    }
  });

  it('listFiles: відсортовані відносні шляхи, .gitkeep не рахується, без теки — []', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-upd-list-'));
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'b.txt'), 'b');
    writeFileSync(join(dir, 'a.txt'), 'a');
    writeFileSync(join(dir, '.gitkeep'), '');
    expect(listFiles(dir)).toEqual(['a.txt', 'sub/b.txt']);
    expect(listFiles(join(dir, 'nema'))).toEqual([]);
  });

  it('reconcileSkillLinks: доробляє відсутні лінки й прибирає осиротілі', async () => {
    const store = await scaffoldStore('upd-skills');
    const skills = join(store, 'node_modules/simplycms/skills');
    mkdirSync(join(skills, 'redesign-from-reference'), { recursive: true });
    writeFileSync(join(skills, 'redesign-from-reference/SKILL.md'), '# r\n');
    // Осиротілий лінк: скіл із пакета зник (перейменували, прибрали), а лінк
    // магазину лишився й веде в порожнечу.
    mkdirSync(join(store, '.claude/skills'), { recursive: true });
    symlinkSync(
      '../../node_modules/simplycms/skills/gone',
      join(store, '.claude/skills/gone'),
    );

    const before = inspectSkillLinks(store);
    expect(before.missing).toEqual([
      '.agents/skills/redesign-from-reference',
      '.claude/skills/redesign-from-reference',
    ]);
    expect(before.orphaned).toEqual(['.claude/skills/gone']);

    const { created, removed } = reconcileSkillLinks(store);
    expect(created).toEqual(before.missing);
    expect(removed).toEqual(['.claude/skills/gone']);
    expect(
      readFileSync(
        join(store, '.claude/skills/redesign-from-reference/SKILL.md'),
        'utf8',
      ),
    ).toBe('# r\n');
    expect(inspectSkillLinks(store)).toEqual({
      skills: ['redesign-from-reference'],
      missing: [],
      orphaned: [],
    });
  });

  it('inspectSkillLinks: ядро без skills/ — skills: null, нічого не робимо', async () => {
    const store = await scaffoldStore('upd-skills-none');
    expect(inspectSkillLinks(store)).toEqual({
      skills: null,
      missing: [],
      orphaned: [],
    });
    expect(reconcileSkillLinks(store)).toEqual({ created: [], removed: [] });
  });

  it('hostDriftExitCode: дрейф під --check → 1, під --write → 0, без дрейфу → 0', () => {
    expect(hostDriftExitCode(['server.mjs'], false)).toBe(1);
    expect(hostDriftExitCode(['server.mjs'], true)).toBe(0);
    expect(hostDriftExitCode([], false)).toBe(0);
  });
});
