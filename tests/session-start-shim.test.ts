import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ensureSessionStartHook } from '../packages/cli/src/hook-entry.mjs';
import { envWithoutNodePath } from '../scripts/pilot-pack/env-without-node-path.mjs';
import { CLI_INDEX, STORE_ENV, scaffoldFakeStore } from './lib/fake-core-store';

// Шим хука старту сесії (Б §3.2, Task 20): без логіки, завжди код 0, друкує JSON
// для Claude Code. Дочірній процес і tmp-теки — тест перевіряє справжній контракт.
const TEMPLATE_CLAUDE = 'packages/create-simplycms-store/template/.claude';
const SHIM = join(TEMPLATE_CLAUDE, 'hooks/session-start.mjs');
const roots: string[] = [];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

/** Порожній магазин зі шимом на місці; `cli` — файли фейкового @simplycms/cli. */
function makeStore(cli?: { bin: string; files: Record<string, string> }) {
  const root = mkdtempSync(join(tmpdir(), 'shim-store-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), '{}');
  mkdirSync(join(root, '.claude/hooks'), { recursive: true });
  cpSync(SHIM, join(root, '.claude/hooks/session-start.mjs'));
  if (cli) {
    const dir = join(root, 'node_modules/@simplycms/cli');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@simplycms/cli', bin: { simplycms: cli.bin } }),
    );
    for (const [file, source] of Object.entries(cli.files)) {
      mkdirSync(join(dir, file, '..'), { recursive: true });
      writeFileSync(join(dir, file), source);
    }
  }
  return root;
}

function runShim(root: string) {
  const started = Date.now();
  // pnpm підставляє NODE_PATH на дерево монорепо — з ним «порожній» магазин бачив би чужий CLI.
  const r = spawnSync('node', [join(root, '.claude/hooks/session-start.mjs')], {
    cwd: root,
    env: { ...envWithoutNodePath(), CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
    timeout: 30_000,
  });
  const parsed = JSON.parse(r.stdout);
  return {
    code: r.status,
    seconds: (Date.now() - started) / 1000,
    context: parsed.hookSpecificOutput.additionalContext as string,
    event: parsed.hookSpecificOutput.hookEventName as string,
  };
}

const cliThat = (source: string) => ({
  bin: 'src/index.mjs',
  files: { 'src/index.mjs': source },
});

/** Знімок дерева: шлях → вміст, щоб довести «шим нічого не пише». */
function snapshot(root: string) {
  const out: Record<string, string> = {};
  for (const e of readdirSync(root, { withFileTypes: true, recursive: true }))
    if (e.isFile()) {
      const path = join(e.parentPath, e.name);
      out[relative(root, path)] = readFileSync(path, 'utf8');
    }
  return out;
}

describe('шим session-start: контракт виходу', () => {
  it('без node_modules → код 0, валідний JSON, «pnpm install»', () => {
    const r = runShim(makeStore());
    expect(r.code).toBe(0);
    expect(r.event).toBe('SessionStart');
    expect(r.context).toContain('УВАГА');
    expect(r.context).toContain('pnpm install');
  });

  it('CLI, що спить 20 с → код 0 за ≤10 с, «УВАГА» з причиною', () => {
    const r = runShim(
      makeStore(cliThat('await new Promise((r) => setTimeout(r, 20000));')),
    );
    expect(r.code).toBe(0);
    expect(r.seconds).toBeLessThanOrEqual(10);
    expect(r.context).toContain('УВАГА');
    expect(r.context).toContain('таймаут');
  }, 20_000);

  it('CLI з виходом 2 і сміттям у stdout → код 0, «УВАГА», сміття не пролізло', () => {
    const r = runShim(
      makeStore(cliThat("console.log('SMITTYA'); process.exit(2);")),
    );
    expect(r.code).toBe(0);
    expect(r.context).toContain('УВАГА');
    expect(r.context).toContain('pnpm simplycms status');
    expect(r.context).not.toContain('SMITTYA');
  });

  it('CLI з порожнім виводом і кодом 0 → «УВАГА»', () => {
    const r = runShim(makeStore(cliThat('process.exit(0);')));
    expect(r.code).toBe(0);
    expect(r.context).toContain('УВАГА');
  });

  it('CLI з кодом 3 і текстом → additionalContext містить текст; аргументи — status --hook', () => {
    const r = runShim(
      makeStore(
        cliThat(
          "console.log('СТАН ' + process.argv.slice(2).join(' ')); process.exit(3);",
        ),
      ),
    );
    expect(r.code).toBe(0);
    expect(r.context).toContain('СТАН status --hook');
  });

  it('CLI з кодом 1 і текстом → текст у additionalContext з префіксом УВАГА', () => {
    const r = runShim(
      makeStore(cliThat("console.log('СТАН З ПРОПУСКОМ'); process.exit(1);")),
    );
    expect(r.code).toBe(0);
    expect(r.context).toMatch(/^УВАГА: частину стану не перевірено\./);
    expect(r.context).toContain('СТАН З ПРОПУСКОМ');
  });

  it('інша розкладка CLI (bin → dist/cli.mjs, src/ немає) → знайдено через package.json', () => {
    const r = runShim(
      makeStore({
        bin: 'dist/cli.mjs',
        files: { 'dist/cli.mjs': "console.log('З DIST');" },
      }),
    );
    expect(r.context).toContain('З DIST');
  });

  it('шим не пише у файли проєкту', () => {
    const root = makeStore(cliThat("console.log('ok');"));
    const before = snapshot(root);
    runShim(root);
    expect(snapshot(root)).toEqual(before);
  });
});

describe('шим як host-файл і запис у settings.json шаблону', () => {
  const cli = (store: string, ...args: string[]) =>
    spawnSync('node', [CLI_INDEX, 'update', '--no-install', ...args], {
      cwd: store,
      env: { ...process.env, ...STORE_ENV },
      encoding: 'utf8',
    });

  it('settings.json шаблону — семантично той запис, що пише ensureSessionStartHook (одне джерело)', () => {
    // Порівняння розібраного JSON: prettier стискає короткий `args` в один рядок, а
    // `JSON.stringify` розкладає його — текст відрізняється, зміст ні.
    expect(
      JSON.parse(readFileSync(join(TEMPLATE_CLAUDE, 'settings.json'), 'utf8')),
    ).toEqual(JSON.parse(ensureSessionStartHook('{}').next));
  });

  it('settings.json шаблону має очікувану форму exec-запису (command/args/matcher/timeout)', () => {
    const settings = JSON.parse(
      readFileSync(join(TEMPLATE_CLAUDE, 'settings.json'), 'utf8'),
    );
    expect(settings.hooks.SessionStart).toEqual([
      {
        matcher: 'startup|clear|compact',
        hooks: [
          {
            type: 'command',
            command: 'node',
            args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs'],
            timeout: 10,
          },
        ],
      },
    ]);
  });

  it('старий відносний запис і наявний шим: update --check → 3, update → запис новий (updated)', async () => {
    const store = await scaffoldFakeStore('hook-legacy', roots);
    const path = join(store, '.claude/settings.json');
    const canon = readFileSync(path, 'utf8');
    writeFileSync(
      path,
      canon
        .replace(
          '"command": "node"',
          '"command": "node .claude/hooks/session-start.mjs"',
        )
        .replace(/\n\s*"args": \[[^\]]*\],/, ''),
    );
    expect(readFileSync(path, 'utf8')).toContain('node .claude/hooks/');
    expect(cli(store, '--check').status).toBe(3);
    expect(readFileSync(path, 'utf8')).toContain('node .claude/hooks/');
    expect(cli(store, '--write').status).toBe(0);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(JSON.parse(canon));
    expect(cli(store, '--check').status).toBe(0);
  });

  it('старий шим: update --check → 3, update --write замінює файл на канон', async () => {
    const store = await scaffoldFakeStore('shim-old', roots);
    const path = join(store, '.claude/hooks/session-start.mjs');
    writeFileSync(path, '// старий шим\n');
    expect(cli(store, '--check').status).toBe(3);
    expect(readFileSync(path, 'utf8')).toBe('// старий шим\n');
    expect(cli(store, '--write').status).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(readFileSync(SHIM, 'utf8'));
  });

  it('наявний магазин без .claude: update без прапорців не пише запис без шиму, а --write — обидва', async () => {
    const store = await scaffoldFakeStore('shim-defer', roots);
    rmSync(join(store, '.claude'), { recursive: true });
    const plain = cli(store);
    // 1 — це дрейф host-файлів без --write (шима немає), а не помилка відкладення.
    expect(plain.status).toBe(1);
    expect(existsSync(join(store, '.claude'))).toBe(false);
    expect(plain.stdout).toContain('разом із шимом');
    expect(cli(store, '--write').status).toBe(0);
    expect(existsSync(join(store, '.claude/settings.json'))).toBe(true);
    expect(existsSync(join(store, '.claude/hooks/session-start.mjs'))).toBe(
      true,
    );
  });

  it('магазин без запису і без шиму: один update --write дає і запис, і шим', async () => {
    const store = await scaffoldFakeStore('shim-none', roots);
    rmSync(join(store, '.claude'), { recursive: true });
    expect(cli(store, '--write').status).toBe(0);
    expect(readFileSync(join(store, '.claude/settings.json'), 'utf8')).toBe(
      ensureSessionStartHook('{}').next,
    );
    expect(
      readFileSync(join(store, '.claude/hooks/session-start.mjs'), 'utf8'),
    ).toBe(readFileSync(SHIM, 'utf8'));
  });
});
