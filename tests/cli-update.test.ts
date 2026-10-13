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
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findHostDrift,
  listFiles,
  writeHostFiles,
} from '../packages/cli/src/host-drift.mjs';
import {
  inspectSkillLinks,
  reconcileSkillLinks,
} from '../packages/cli/src/skill-links.mjs';
import { AFTER_INSTALL } from '../packages/cli/src/update-handover.mjs';
import {
  run,
  parseUpdateArgs,
  planCoreInstall,
} from '../packages/cli/src/update.mjs';
import { ensureSessionStartHook } from '../packages/cli/src/hook-entry.mjs';
import { resolveUpdateTarget } from '../packages/cli/src/update-target.mjs';
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
  it('parseUpdateArgs: дефолт, повний набір, --check без install, гучні помилки', () => {
    const base = { check: false, write: false, install: true, to: undefined };
    expect(parseUpdateArgs([])).toEqual({ ...base, afterInstall: false });
    expect(
      parseUpdateArgs(['--write', '--to', '0.4.0', '--no-install']),
    ).toEqual({
      ...base,
      write: true,
      install: false,
      to: '0.4.0',
      afterInstall: false,
    });
    // Е8-Р12: --check — чиста перевірка, install вимкнений самим прапорцем.
    expect(parseUpdateArgs(['--check'])).toEqual({
      ...base,
      check: true,
      install: false,
      afterInstall: false,
    });
    // Р21: маркер дочірнього процесу вимикає install — інакше нескінченний цикл.
    expect(parseUpdateArgs(['--write', AFTER_INSTALL])).toEqual({
      ...base,
      write: true,
      install: false,
      afterInstall: true,
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

  it('resolveUpdateTarget: --to як є; реєстр — лише без --to', () => {
    const neverCalled = () => {
      throw new Error('не мав викликатися');
    };
    expect(
      resolveUpdateTarget('0.4.0', { exec: neverCalled, current: '0.3.0' }),
    ).toEqual({ version: '0.4.0', status: 'install' });
    expect(
      resolveUpdateTarget(undefined, {
        exec: () => '{"latest":"0.5.0"}\n',
        current: '0.4.0',
      }),
    ).toEqual({ version: '0.5.0', status: 'install' });
  });

  it('resolveUpdateTarget: реєстр недоступний або мовчить — падіння з підказкою --to', () => {
    const offline = () => {
      throw new Error('ENOTFOUND registry.npmjs.org');
    };
    const ctx = { current: '0.4.0' };
    expect(() =>
      resolveUpdateTarget(undefined, { ...ctx, exec: offline }),
    ).toThrow(/--to/);
    expect(() =>
      resolveUpdateTarget(undefined, { ...ctx, exec: () => '' }),
    ).toThrow(/--to/);
    expect(() =>
      resolveUpdateTarget(undefined, { ...ctx, exec: () => '{}' }),
    ).toThrow(/--to/);
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
    mkdirSync(join(skills, 'simplycms-redesign'), { recursive: true });
    writeFileSync(join(skills, 'simplycms-redesign/SKILL.md'), '# r\n');
    // Осиротілий лінк: скіл із пакета зник (перейменували, прибрали), а лінк
    // магазину лишився й веде в порожнечу.
    mkdirSync(join(store, '.claude/skills'), { recursive: true });
    symlinkSync(
      '../../node_modules/simplycms/skills/gone',
      join(store, '.claude/skills/gone'),
    );

    const before = inspectSkillLinks(store);
    expect(before.missing).toEqual([
      '.agents/skills/simplycms-redesign',
      '.claude/skills/simplycms-redesign',
    ]);
    expect(before.orphaned).toEqual(['.claude/skills/gone']);

    const { created, removed } = reconcileSkillLinks(store);
    expect(created).toEqual(before.missing);
    expect(removed).toEqual(['.claude/skills/gone']);
    expect(
      readFileSync(
        join(store, '.claude/skills/simplycms-redesign/SKILL.md'),
        'utf8',
      ),
    ).toBe('# r\n');
    expect(inspectSkillLinks(store)).toEqual({
      skills: ['simplycms-redesign'],
      missing: [],
      orphaned: [],
    });
  });

  it('reconcileSkillLinks: перейменований скіл — старий лінк прибрано, новий створено', async () => {
    const store = await scaffoldStore('upd-skills-rename');
    const skills = join(store, 'node_modules/simplycms/skills');
    mkdirSync(join(skills, 'simplycms-redesign'), { recursive: true });
    writeFileSync(join(skills, 'simplycms-redesign/SKILL.md'), '# r\n');
    // Магазин, створений до перейменування: лінки на скіл, якого пакет уже не везе.
    for (const dir of ['.agents/skills', '.claude/skills']) {
      mkdirSync(join(store, dir), { recursive: true });
      symlinkSync(
        '../../node_modules/simplycms/skills/redesign-from-reference',
        join(store, dir, 'redesign-from-reference'),
      );
    }

    const { created, removed } = reconcileSkillLinks(store);
    expect(removed).toEqual([
      '.agents/skills/redesign-from-reference',
      '.claude/skills/redesign-from-reference',
    ]);
    expect(created).toEqual([
      '.agents/skills/simplycms-redesign',
      '.claude/skills/simplycms-redesign',
    ]);
    expect(inspectSkillLinks(store)).toEqual({
      skills: ['simplycms-redesign'],
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

  describe('run: відсутня тека міграцій магазину', () => {
    const MISSING = 'Тека міграцій магазину db/migrations відсутня.';
    const CANON = fileURLToPath(
      new URL('../packages/cli/host', import.meta.url),
    );
    const initialExitCode = process.exitCode;
    afterEach(() => {
      vi.restoreAllMocks();
      process.exitCode = initialExitCode;
    });

    /** Ізоляція: `findStoreRoot` читає `process.cwd()`, вивід clack — `process.stdout`. */
    async function runIn(store: string, argv: string[]) {
      let out = '';
      vi.spyOn(process, 'cwd').mockReturnValue(store);
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        out += String(chunk);
        return true;
      });
      process.exitCode = undefined;
      await run(argv);
      return { out, code: process.exitCode };
    }

    it('--write: host-файли перезаписано, а відсутня тека все одно дає exitCode 1', async () => {
      const store = await scaffoldStore('upd-nomig-write');
      rmSync(join(store, 'db', 'migrations'), { recursive: true });
      writeFileSync(join(store, 'server.mjs'), '// розсинхрон\n');
      const { out, code } = await runIn(store, ['--no-install', '--write']);
      expect(code).toBe(1);
      expect(out).toContain(MISSING);
      expect(readFileSync(join(store, 'server.mjs'), 'utf8')).toBe(
        readFileSync(join(CANON, 'server.mjs'), 'utf8'),
      );
    });

    it('без дрейфу: «дрейфу немає» теж не мовчить про відсутню теку', async () => {
      const store = await scaffoldStore('upd-nomig-clean');
      rmSync(join(store, 'db', 'migrations'), { recursive: true });
      const { out, code } = await runIn(store, ['--no-install']);
      expect(code).toBe(1);
      expect(out).toContain(MISSING);
    });

    it('db/migrations — файл: зрозуміла відмова, exitCode 1, без ENOTDIR', async () => {
      const store = await scaffoldStore('upd-mig-file');
      rmSync(join(store, 'db', 'migrations'), { recursive: true });
      writeFileSync(join(store, 'db', 'migrations'), 'не тека\n');
      const { out, code } = await runIn(store, ['--no-install']);
      expect(code).toBe(1);
      expect(out).toContain('не тека');
    });

    it('з db/migrations і без дрейфу: exitCode не 1', async () => {
      const store = await scaffoldStore('upd-mig-ok');
      const { out, code } = await runIn(store, ['--no-install']);
      expect(code).not.toBe(1);
      expect(out).not.toContain(MISSING);
    });
  });
});

describe('run: --check без мережі й передача керування новому CLI (Е8-Р12, Р21)', () => {
  const initialExitCode = process.exitCode;
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = initialExitCode;
  });

  /** Будь-який дочірній процес — помилка тесту: --check і --after-install мережі не мають. */
  type Exec = (command: string, args: string[]) => unknown;
  const forbidden: Exec = (command, args) => {
    throw new Error(`exec не мав викликатися: ${command} ${args.join(' ')}`);
  };

  async function runIn(store: string, argv: string[], exec: Exec = forbidden) {
    let out = '';
    vi.spyOn(process, 'cwd').mockReturnValue(store);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });
    process.exitCode = undefined;
    await run(argv, { exec });
    return { out, code: process.exitCode };
  }

  /** Магазин у стані «все збігається»: ядро з agent/, хук записано, CLI встановлено. */
  async function cleanStore(name: string) {
    const store = await scaffoldStore(name);
    const core = join(store, 'node_modules', 'simplycms');
    mkdirSync(core, { recursive: true });
    writeFileSync(
      join(core, 'package.json'),
      JSON.stringify({ name: 'simplycms', version: '9.9.9' }),
    );
    symlinkSync(resolve('packages/simplycms/agent'), join(core, 'agent'));
    mkdirSync(join(store, '.claude'), { recursive: true });
    writeFileSync(
      join(store, '.claude/settings.json'),
      ensureSessionStartHook('{}').next,
    );
    const cli = join(store, 'node_modules', '@simplycms', 'cli');
    mkdirSync(cli, { recursive: true });
    writeFileSync(
      join(cli, 'package.json'),
      JSON.stringify({
        name: '@simplycms/cli',
        bin: { simplycms: 'bin/x.mjs' },
      }),
    );
    return store;
  }

  it('--check без розбіжностей → код 0, жодного дочірнього процесу', async () => {
    const store = await cleanStore('chk-clean');
    const { code } = await runIn(store, ['--check']);
    expect(code ?? 0).toBe(0);
  });

  it('--check з розбіжністю блоку → код 3, AGENTS.md не переписано', async () => {
    const store = await cleanStore('chk-block');
    const path = join(store, 'AGENTS.md');
    const edited = readFileSync(path, 'utf8').replace(
      '## Як працювати',
      '## Інакше',
    );
    writeFileSync(path, edited);
    const { code, out } = await runIn(store, ['--check']);
    expect(code).toBe(3);
    expect(out).toContain('керований блок AGENTS.md');
    expect(readFileSync(path, 'utf8')).toBe(edited);
  });

  it('--check без запису хука → код 3; без прапорців хук і блок записано', async () => {
    const store = await cleanStore('chk-hook');
    rmSync(join(store, '.claude/settings.json'));
    const path = join(store, 'AGENTS.md');
    const fresh = readFileSync(path, 'utf8');
    writeFileSync(path, fresh.replace('## Як працювати', '## Інакше'));
    expect((await runIn(store, ['--check'])).code).toBe(3);
    expect((await runIn(store, ['--no-install'])).code ?? 0).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(fresh);
    expect((await runIn(store, ['--check'])).code ?? 0).toBe(0);
  });

  it('після pnpm add — запуск НОВОГО CLI з --after-install і тим самим argv; код — його', async () => {
    const store = await cleanStore('reexec');
    // Дрейф, який старий процес мав би «полагодити» своїм каноном, — не його справа.
    writeFileSync(join(store, 'server.mjs'), '// стара версія\n');
    const calls: string[][] = [];
    const exec = (command: string, args: string[]) => {
      calls.push([command, ...args]);
      if (command === process.execPath)
        throw Object.assign(new Error('exit 3'), { status: 3 });
      return undefined;
    };
    const argv = ['--write', '--to', '10.0.0'];
    const { code } = await runIn(store, argv, exec);
    expect(calls.map((c) => c.slice(0, 2).join(' '))).toEqual([
      'pnpm add',
      'pnpm add',
      `${process.execPath} ${join(store, 'node_modules/@simplycms/cli/bin/x.mjs')}`,
    ]);
    expect(calls.at(-1)?.slice(2)).toEqual(['update', AFTER_INSTALL, ...argv]);
    expect(code).toBe(3);
    expect(readFileSync(join(store, 'server.mjs'), 'utf8')).toBe(
      '// стара версія\n',
    );
  });

  it('--after-install: ні install, ні повторного запуску; звірка своїм каноном', async () => {
    const store = await cleanStore('after');
    writeFileSync(join(store, 'server.mjs'), '// стара версія\n');
    const { code, out } = await runIn(store, [
      '--write',
      '--to',
      '10.0.0',
      AFTER_INSTALL,
    ]);
    expect(code ?? 0).toBe(0);
    // Заголовок друкує батьківський процес; дочірній його не дублює.
    expect(out).not.toContain('┌');
    expect(readFileSync(join(store, 'server.mjs'), 'utf8')).toBe(
      readFileSync('packages/cli/host/server.mjs', 'utf8'),
    );
  });

  it('--no-install → дочірніх процесів немає', async () => {
    const store = await cleanStore('noinst');
    const { code } = await runIn(store, ['--no-install', '--write']);
    expect(code ?? 0).toBe(0);
  });

  it('--check + дрейф host-файлів → код 3, файл не чіпано, порада --write один раз', async () => {
    const store = await cleanStore('chk-host');
    writeFileSync(join(store, 'server.mjs'), '// локальна правка\n');
    const { code, out } = await runIn(store, ['--check']);
    expect(code).toBe(3);
    expect(out).toContain('дрейф host-файлів: server.mjs');
    expect(out.split('update --write').length - 1).toBe(1);
    expect(readFileSync(join(store, 'server.mjs'), 'utf8')).toBe(
      '// локальна правка\n',
    );
  });

  it('CLAUDE.md: відсутній — створено з agent/claude-md.md; без @AGENTS.md — не переписано, --check → 3', async () => {
    const store = await cleanStore('claude');
    const path = join(store, 'CLAUDE.md');
    rmSync(path);
    expect((await runIn(store, ['--check'])).code).toBe(3);
    expect((await runIn(store, ['--no-install'])).code ?? 0).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(
      readFileSync('packages/simplycms/agent/claude-md.md', 'utf8'),
    );
    writeFileSync(path, '# мої правила без імпорту\n');
    const { out } = await runIn(store, ['--no-install']);
    expect(out).toContain('@AGENTS.md');
    expect(readFileSync(path, 'utf8')).toBe('# мої правила без імпорту\n');
    expect((await runIn(store, ['--check'])).code).toBe(3);
  });

  it('після install без CLI в node_modules — зрозуміла відмова з --no-install; bin рядком теж працює', async () => {
    const store = await cleanStore('nocli');
    const cli = join(store, 'node_modules', '@simplycms', 'cli');
    const exec = () => undefined;
    rmSync(join(cli, 'package.json'));
    await expect(runIn(store, ['--to', '10.0.0'], exec)).rejects.toThrow(
      /update --no-install/,
    );
    writeFileSync(
      join(cli, 'package.json'),
      JSON.stringify({ name: '@simplycms/cli', bin: 'cli.mjs' }),
    );
    const calls: string[][] = [];
    await runIn(
      store,
      ['--to', '10.0.0'],
      (command: string, args: string[]) => {
        calls.push([command, ...args]);
        return undefined;
      },
    );
    expect(calls.at(-1)?.[1]).toBe(join(cli, 'cli.mjs'));
  });
});
