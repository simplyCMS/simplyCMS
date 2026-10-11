import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPgDriver } from '../packages/cli/src/doctor-pg-check.mjs';
import { pgUpdateHint, satisfies } from '../packages/cli/src/pg-peer.mjs';
import { runOfflineChecks } from '../packages/cli/src/doctor-checks.mjs';
import { run } from '../packages/cli/src/update.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// doctor №13 і підказка `update` про драйвер БД (К3-Е7, Task 11): `pg` — пряма залежність
// магазину в межах peer-діапазону ядра. `update` версію pg НЕ переписує.
async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-pg-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

const manifestOf = (store: string) =>
  JSON.parse(readFileSync(join(store, 'package.json'), 'utf8'));

/** Імітація встановленого `node_modules`: peer ядра й версія pg. */
function fakeInstall(
  store: string,
  { peer, pg }: { peer?: string; pg?: string },
) {
  const write = (name: string, json: object) => {
    mkdirSync(join(store, 'node_modules', name), { recursive: true });
    writeFileSync(
      join(store, 'node_modules', name, 'package.json'),
      JSON.stringify(json),
    );
  };
  write('simplycms', {
    name: 'simplycms',
    peerDependencies: peer ? { pg: peer } : {},
  });
  if (pg) write('pg', { name: 'pg', version: pg });
}

describe('satisfies', () => {
  it.each([
    ['8.23.1', '8.23.1', true],
    ['8.22.0', '8.23.1', false],
    ['8.23.2', '^8.23.1', true],
    ['9.0.0', '^8.23.1', false],
    ['8.24.0', '~8.23.1', false],
    ['8.23.9', '~8.23.1', true],
    ['8.0.1', '>=8.0.0', true],
    ['7.9.0', '^8.0.0 || ^7.0.0', true],
    ['0.2.5', '^0.2.1', true],
    ['0.3.0', '^0.2.1', false],
  ])('%s у «%s» → %s', (v, range, want) =>
    expect(satisfies(v, range)).toBe(want),
  );
  it('невідома форма діапазону → null, не вгадування', () => {
    expect(satisfies('8.23.1', '8.x')).toBeNull();
  });
});

describe('doctor №13: checkPgDriver', () => {
  it('немає pg у dependencies магазину → error', async () => {
    const store = await scaffoldStore('pg-none');
    const manifest = manifestOf(store);
    delete manifest.dependencies.pg;
    fakeInstall(store, { peer: '8.23.1', pg: '8.23.1' });
    const r = checkPgDriver({ storeRoot: store, manifest });
    expect(r.status).toBe('error');
    expect(r.details).toContain('pg не оголошено');
  });

  it('pg лише в devDependencies → error (в прод-залежностях його немає)', async () => {
    const store = await scaffoldStore('pg-dev');
    const manifest = manifestOf(store);
    manifest.devDependencies = { pg: manifest.dependencies.pg };
    delete manifest.dependencies.pg;
    fakeInstall(store, { peer: '8.23.1', pg: '8.23.1' });
    expect(checkPgDriver({ storeRoot: store, manifest }).status).toBe('error');
  });

  it('встановлена версія не задовольняє peer ядра → error з підказкою', async () => {
    const store = await scaffoldStore('pg-wrong');
    fakeInstall(store, { peer: '8.23.1', pg: '8.22.0' });
    const r = checkPgDriver({ storeRoot: store, manifest: manifestOf(store) });
    expect(r.status).toBe('error');
    expect(r.details).toContain('8.22.0');
    expect(r.details).toContain('8.23.1');
  });

  it('версія в межах peer → ok', async () => {
    const store = await scaffoldStore('pg-ok');
    fakeInstall(store, { peer: '8.23.1', pg: '8.23.1' });
    expect(
      checkPgDriver({ storeRoot: store, manifest: manifestOf(store) }).status,
    ).toBe('ok');
  });

  it('ядро не встановлено → skip (peer-діапазон невідомий)', async () => {
    const store = await scaffoldStore('pg-noinstall');
    expect(
      checkPgDriver({ storeRoot: store, manifest: manifestOf(store) }).status,
    ).toBe('skip');
  });

  it('змонтована в runOfflineChecks під id pg-driver', async () => {
    const store = await scaffoldStore('pg-mounted');
    const checks = runOfflineChecks({
      storeRoot: store,
      manifest: manifestOf(store),
      env: {},
      cliVersion: '9.9.9-sentinel',
      hostDir: join(store, 'no-canon'),
      schemaMigrationsDir: join(store, 'node_modules/simplycms/migrations'),
    });
    expect(checks.some((c) => c.id === 'pg-driver')).toBe(true);
  });
});

describe('update: підказка про pg, без переписування', () => {
  const initialExitCode = process.exitCode;
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = initialExitCode;
  });

  async function runIn(store: string) {
    let out = '';
    vi.spyOn(process, 'cwd').mockReturnValue(store);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });
    await run(['--no-install']);
    return out;
  }

  it('розбіжність із peer: друкує що оновити, package.json байт-ідентичний', async () => {
    const store = await scaffoldStore('pg-upd-mismatch');
    fakeInstall(store, { peer: '8.30.0', pg: '8.23.1' });
    const before = readFileSync(join(store, 'package.json'), 'utf8');
    const out = await runIn(store);
    expect(out).toContain('pnpm add pg@8.30.0');
    expect(readFileSync(join(store, 'package.json'), 'utf8')).toBe(before);
  });

  it('збіг із peer: мовчить про pg', async () => {
    const store = await scaffoldStore('pg-upd-ok');
    fakeInstall(store, { peer: '8.23.1', pg: '8.23.1' });
    expect(await runIn(store)).not.toContain('pnpm add pg@');
  });

  it('pgUpdateHint: без ядра в node_modules нема з чим порівнювати → null', async () => {
    const store = await scaffoldStore('pg-upd-nocore');
    expect(pgUpdateHint(store, manifestOf(store))).toBeNull();
  });
});
