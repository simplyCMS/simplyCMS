/**
 * Gate TOOL, крок Р21: одиночний `simplycms update --write` доставляє host-файли
 * НОВОЇ версії CLI. Юніт цього не доведе за побудовою: дефект живе в тому, що
 * після `pnpm add` процес лишається старим CLI з каноном host/ своєї версії (Node
 * резолвить реальний шлях у `.pnpm/@simplycms+cli@<стара>`), — видно лише на двох
 * справжніх tarball-ах і справжньому pnpm.
 *
 * Обидва tarball-и — з поточних сирців (стара версія теж уміє передати керування:
 * це вимога саме до версії, З ЯКОЇ оновлюються); відрізняються версією і каноном
 * `host/server.mjs`. Віддає їх локальний реєстр лише для скоупу `@simplycms`
 * (`.npmrc` магазину): update кличе справжній `pnpm add -D @simplycms/cli@0.0.2`,
 * а overrides на `file:` прямий `add` не перехоплюють (заміряно: pnpm іде в npmjs).
 */

import { execFile as execFileCb } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

// Асинхронно: реєстр живе в цьому ж процесі, execFileSync заблокував би його.
const execFile = promisify(execFileCb);
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
  const manifest = {
    ...JSON.parse(readFileSync(manifestPath, 'utf8')),
    version,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest));
  if (mark) writeFileSync(join(dir, 'host/server.mjs'), mark, { flag: 'a' });
  const out = join(work, `tgz-${version}`);
  await execFile('pnpm', ['--dir', dir, 'pack', '--pack-destination', out]);
  const bytes = readFileSync(join(out, readdirSync(out)[0]));
  return { dir, manifest, bytes };
}

/** Мінімальний реєстр: packument `@simplycms/cli` і tarball-и обох версій. */
async function startRegistry(variants) {
  const server = createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const tarball = variants.find(
      (v) => req.url === `/cli-${v.manifest.version}.tgz`,
    );
    if (tarball) return res.end(tarball.bytes);
    if (decodeURIComponent(req.url) !== '/@simplycms/cli') {
      res.statusCode = 404;
      return res.end('{}');
    }
    const versions = {};
    const time = {};
    for (const { manifest, bytes } of variants) {
      const sha512 = createHash('sha512').update(bytes).digest('base64');
      versions[manifest.version] = {
        ...manifest,
        dist: {
          tarball: `${base}/cli-${manifest.version}.tgz`,
          integrity: `sha512-${sha512}`,
          shasum: createHash('sha1').update(bytes).digest('hex'),
        },
      };
      // Давня дата публікації: інакше дефолтний minimumReleaseAge pnpm 11 відмовить.
      time[manifest.version] = '2020-01-01T00:00:00.000Z';
    }
    const latest = variants.at(-1).manifest.version;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        name: '@simplycms/cli',
        'dist-tags': { latest },
        versions,
        time,
      }),
    );
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return server;
}

/** Порожній магазин зі старим CLI: devDependency + host-файли його канону. */
async function storeOnOld(store, registry, old) {
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
  const port = registry.address().port;
  writeFileSync(
    join(store, '.npmrc'),
    `@simplycms:registry=http://127.0.0.1:${port}/\n`,
  );
  await execFile('pnpm', ['install', '--prefer-offline'], { cwd: store });
  cpSync(join(old.dir, 'host'), store, { recursive: true });
}

/**
 * @param {string} work робоча тека Gate TOOL
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function updateReexecSmoke(work) {
  const old = await packVariant(work, '0.0.1', '');
  const next = await packVariant(work, '0.0.2', NEW_MARK);
  const registry = await startRegistry([old, next]);
  try {
    const store = join(work, 'r21-store');
    await storeOnOld(store, registry, old);
    const { stdout } = await execFile(
      'pnpm',
      ['exec', 'simplycms', 'update', '--write', '--to', '0.0.2'],
      { cwd: store },
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
