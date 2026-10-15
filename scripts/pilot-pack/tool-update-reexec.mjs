/**
 * Gate TOOL, крок Р21: одиночний `simplycms update --write` доставляє host-файли
 * НОВОЇ версії CLI. Юніт цього не доведе за побудовою: дефект живе в тому, що
 * після `pnpm add` процес лишається старим CLI з каноном host/ своєї версії (Node
 * резолвить реальний шлях у `.pnpm/@simplycms+cli@<стара>`), — видно лише на двох
 * справжніх tarball-ах і справжньому pnpm.
 *
 * Обидва tarball-и — з поточних сирців (стара версія теж уміє передати керування:
 * це вимога саме до версії, З ЯКОЇ оновлюються); відрізняються версією і каноном
 * `host/server.mjs`. Усе, що ставить pnpm (обидва CLI і дерево їхніх залежностей
 * з `node_modules` монорепо), віддає локальний реєстр — без мережі. Overrides на
 * `file:` не годяться (заміряно): прямий `pnpm add` їх ігнорує й іде в npmjs.
 */

import { execFile as execFileCb } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { packInstalledTree, startLocalRegistry } from './local-registry.mjs';

// Асинхронно: реєстр живе в цьому ж процесі, execFileSync заблокував би його.
const execFile = promisify(execFileCb);
const TIMEOUT = 180_000;
const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI_DIR = join(REPO_ROOT, 'packages/cli');
const NEW_MARK = '\n// канон host/ нової версії CLI (Gate TOOL, Р21)\n';

/** Копія сирців CLI з іншою версією (і, для нової, іншим каноном) → tarball. */
async function packVariant(work, version, mark) {
  const dir = join(work, `cli-${version}`);
  cpSync(CLI_DIR, dir, {
    recursive: true,
    filter: (path) => !path.includes('node_modules'),
  });
  const manifestPath = join(dir, 'package.json');
  const source = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = { ...source, version };
  writeFileSync(manifestPath, JSON.stringify(manifest));
  if (mark) writeFileSync(join(dir, 'host/server.mjs'), mark, { flag: 'a' });
  const out = join(work, `tgz-${version}`);
  await execFile('pnpm', ['--dir', dir, 'pack', '--pack-destination', out], {
    timeout: TIMEOUT,
  });
  const bytes = readFileSync(join(out, readdirSync(out)[0]));
  return { dir, manifest, bytes };
}

/** Порожній магазин зі старим CLI: devDependency + host-файли його канону. */
async function storeOnOld(store, registryUrl, old) {
  mkdirSync(join(store, 'db/migrations'), { recursive: true });
  const template = readFileSync(
    join(
      REPO_ROOT,
      'packages/create-simplycms-store/template/package.json.tpl',
    ),
    'utf8',
  );
  const { packageManager } = JSON.parse(
    template.replaceAll('__SIMPLYCMS_VERSION__', '0.0.0'),
  );
  writeFileSync(
    join(store, 'package.json'),
    JSON.stringify({
      name: 'r21-store',
      private: true,
      packageManager,
      devDependencies: { '@simplycms/cli': old.manifest.version },
    }),
  );
  // ВЕСЬ реєстр — локальний: пакет поза набором дає 404, а не похід у мережу.
  writeFileSync(join(store, '.npmrc'), `registry=${registryUrl}\n`);
  await execFile('pnpm', ['install'], { cwd: store, timeout: TIMEOUT });
  cpSync(join(old.dir, 'host'), store, { recursive: true });
}

/**
 * @param {string} work робоча тека Gate TOOL
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function updateReexecSmoke(work) {
  const old = await packVariant(work, '0.0.1', '');
  const next = await packVariant(work, '0.0.2', NEW_MARK);
  const deps = [];
  for (const name of Object.keys(old.manifest.dependencies ?? {}))
    deps.push(
      ...(await packInstalledTree(
        join(CLI_DIR, 'node_modules', name),
        join(work, 'deps'),
      )),
    );
  const registry = await startLocalRegistry([old, next, ...deps]);
  try {
    const store = join(work, 'r21-store');
    await storeOnOld(store, registry.url, old);
    const { stdout } = await execFile(
      'pnpm',
      ['exec', 'simplycms', 'update', '--write', '--to', '0.0.2'],
      { cwd: store, timeout: TIMEOUT },
    );
    const actual = readFileSync(join(store, 'server.mjs'), 'utf8');
    if (actual !== readFileSync(join(next.dir, 'host/server.mjs'), 'utf8'))
      return {
        ok: false,
        details: [
          '✗ Р21: після одного update --write host-файли магазину ≠ канон нової ' +
            'версії (звірку зробив старий CLI своїм каноном)',
        ],
      };
    if (stdout.includes('збігаються з каноном'))
      return {
        ok: false,
        details: [
          '✗ Р21: update звітував «збігаються з каноном» — звіряв старий канон',
        ],
      };
    return {
      ok: true,
      details: [
        '✓ Р21: один update --write 0.0.1 → 0.0.2 доставив host-файли нової версії',
      ],
    };
  } finally {
    registry.close();
  }
}
