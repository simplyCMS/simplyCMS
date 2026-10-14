import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkHostDrift } from '../packages/cli/src/doctor-fs-checks.mjs';
import { CANON_HOST_DIR } from '../packages/cli/src/host-drift.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// Шими прод-старту й запрошення власника — host-файли (F5 рев'ю Е8): їхня логіка
// живе в ядрі, а сам шим магазину стереже doctor №6 проти СПРАВЖНЬОГО канону
// `packages/cli/host/` (не штучної теки), тож правка шима в магазині видна, а
// `simplycms update --write` її відкочує.
const SHIMS = ['scripts/start.mjs', 'scripts/owner-invite.mjs'] as const;

const roots: string[] = [];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

async function scaffoldStore(name: string) {
  const root = mkdtempSync(join(tmpdir(), 'cli-doc-shim-'));
  roots.push(root);
  const target = join(root, name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

describe('doctor №6: шими scripts/ — host-файли під каноном', () => {
  it('свіжий скаффолд збігається з каноном host/ CLI', async () => {
    const store = await scaffoldStore('shim-ok');
    const result = checkHostDrift({
      storeRoot: store,
      hostDir: CANON_HOST_DIR,
    });
    expect(result.status, result.details).toBe('ok');
  });

  it.each(SHIMS)('дрейф шима %s — warn з іменем файла', async (shim) => {
    const store = await scaffoldStore('shim-drift');
    appendFileSync(join(store, shim), '\n// локальна правка\n');
    const result = checkHostDrift({
      storeRoot: store,
      hostDir: CANON_HOST_DIR,
    });
    expect(result.status).toBe('warn');
    expect(result.details).toContain(shim);
    expect(result.details).toContain('update --write');
  });
});
