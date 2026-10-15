/**
 * Мінімальний npm-реєстр для пакувальних смоків: віддає packument-и й tarball-и
 * лише того, що йому дали, тож прогін pnpm проти нього герметичний — будь-яка
 * залежність поза набором дає 404, а не тихий похід у npmjs.
 *
 * Сторонні залежності (`@clack/prompts` і її дерево) пакуються з `node_modules`
 * монорепо: та сама версія, що в lockfile, без мережі.
 */

import { execFile as execFileCb } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

/** Тека `node_modules`, у якій лежить пакет (pnpm кладе залежності поруч). */
function siblingsRoot(pkgDir) {
  const at = pkgDir.lastIndexOf(`${sep}node_modules${sep}`);
  return pkgDir.slice(0, at + `${sep}node_modules`.length);
}

/**
 * Запакувати пакет і його `dependencies` (транзитивно) з установленого дерева.
 * @param {string} pkgDir тека встановленого пакета (симлінк чи реальна)
 * @param {string} work тека для tarball-ів
 * @returns {Promise<{ manifest: Record<string, unknown>; bytes: Buffer }[]>}
 */
export async function packInstalledTree(pkgDir, work) {
  const packed = new Map();
  const queue = [realpathSync(pkgDir)];
  while (queue.length > 0) {
    const dir = queue.shift();
    const manifest = JSON.parse(
      readFileSync(join(dir, 'package.json'), 'utf8'),
    );
    const key = `${manifest.name}@${manifest.version}`;
    if (packed.has(key)) continue;
    // Копія без node_modules під префіксом `package/` — формат npm-tarball-а.
    const stage = join(work, key.replace(/[@/]/g, '_'));
    cpSync(dir, join(stage, 'package'), {
      recursive: true,
      dereference: true,
      filter: (path) => !path.slice(dir.length).includes('node_modules'),
    });
    const tgz = join(stage, 'pkg.tgz');
    await execFile('tar', ['-czf', tgz, '-C', stage, 'package'], {
      timeout: 60_000,
    });
    packed.set(key, { manifest, bytes: readFileSync(tgz) });
    for (const dep of Object.keys(manifest.dependencies ?? {}))
      queue.push(realpathSync(join(siblingsRoot(dir), dep)));
  }
  return [...packed.values()];
}

/** Packument імені з усіх версій набору. */
function packument(name, entries, base) {
  const versions = {};
  const time = {};
  for (const { manifest, bytes } of entries) {
    const file = `${base}/-/${encodeURIComponent(name)}-${manifest.version}.tgz`;
    versions[manifest.version] = {
      ...manifest,
      dist: {
        tarball: file,
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
        shasum: createHash('sha1').update(bytes).digest('hex'),
      },
    };
    // Давня дата: інакше дефолтний minimumReleaseAge pnpm 11 відмовить.
    time[manifest.version] = '2020-01-01T00:00:00.000Z';
  }
  const latest = entries.at(-1).manifest.version;
  return { name, 'dist-tags': { latest }, versions, time };
}

/**
 * Підняти реєстр на випадковому порту 127.0.0.1.
 * @param {{ manifest: { name: string; version: string }; bytes: Buffer }[]} entries
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export async function startLocalRegistry(entries) {
  const byName = Map.groupBy(entries, (entry) => entry.manifest.name);
  const server = createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const url = decodeURIComponent(req.url ?? '');
    for (const [name, list] of byName) {
      if (url === `/${name}`) {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(packument(name, list, base)));
      }
      const hit = list.find(
        (e) => url === `/-/${name}-${e.manifest.version}.tgz`,
      );
      if (hit) return res.end(hit.bytes);
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => server.close(),
  };
}
