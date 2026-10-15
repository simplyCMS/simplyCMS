import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkMailDriver } from '../packages/cli/src/doctor-mail-check.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// doctor №14 (К3-Е8, Task 9, Е8-Р11): `nodemailer` — пряма залежність магазину в межах
// peer-діапазону ядра. Дзеркало №13 (`cli-pg-driver`).
async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-mail-')), name);
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

function fakeInstall(
  store: string,
  { peer, version }: { peer?: string; version?: string },
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
    peerDependencies: peer ? { nodemailer: peer } : {},
  });
  if (version) write('nodemailer', { name: 'nodemailer', version });
}

describe('doctor №14: checkMailDriver', () => {
  it('немає nodemailer у dependencies магазину → error', async () => {
    const store = await scaffoldStore('mail-none');
    const manifest = manifestOf(store);
    delete manifest.dependencies.nodemailer;
    fakeInstall(store, { peer: '10.1.0', version: '10.1.0' });
    const r = checkMailDriver({ storeRoot: store, manifest });
    expect(r.status).toBe('error');
    expect(r.details).toContain('nodemailer не оголошено');
  });

  it('версія не задовольняє peer ядра → error з підказкою', async () => {
    const store = await scaffoldStore('mail-wrong');
    fakeInstall(store, { peer: '10.1.0', version: '10.0.0' });
    const r = checkMailDriver({
      storeRoot: store,
      manifest: manifestOf(store),
    });
    expect(r.status).toBe('error');
    expect(r.details).toContain('10.0.0');
    expect(r.details).toContain('10.1.0');
  });

  it('версія в межах peer → ok', async () => {
    const store = await scaffoldStore('mail-ok');
    fakeInstall(store, { peer: '10.1.0', version: '10.1.0' });
    expect(
      checkMailDriver({ storeRoot: store, manifest: manifestOf(store) }).status,
    ).toBe('ok');
  });

  it('ядро не встановлено → skip (peer-діапазон невідомий)', async () => {
    const store = await scaffoldStore('mail-noinstall');
    expect(
      checkMailDriver({ storeRoot: store, manifest: manifestOf(store) }).status,
    ).toBe('skip');
  });
});
