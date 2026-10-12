import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/**
 * Каталог ВСТАНОВЛЕНОГО пакета: іде вгору по `node_modules` від `fromDir` (як
 * Node), а для кожного наступного пакета ланцюжка — від справжнього шляху
 * попереднього. Так транзитивну залежність (`@tanstack/start-server-core` —
 * залежність `@tanstack/react-start`) знаходимо тим самим шляхом, яким її
 * бачить збірка, без хардкоду `node_modules/.pnpm/<pkg>@<версія>` (версія в
 * шляху — рівно те, що змінюється при бампі).
 */
export function installedPackageDir(
  chain: readonly string[],
  fromDir = ROOT,
): string {
  let dir = fromDir;
  for (const name of chain) {
    dir = realpathSync(findUp(name, dir));
  }
  return dir;
}

function findUp(name: string, fromDir: string): string {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) {
      throw new Error(`пакет ${name} не знайдено від ${fromDir}`);
    }
  }
}

/** Файл встановленого пакета зник: бібліотека, ймовірно, змінила структуру. */
export class InstalledFileMissingError extends Error {
  constructor(
    readonly pkg: string,
    readonly version: string,
    readonly relPath: string,
  ) {
    super(`файл ${relPath} у ${pkg}@${version} не знайдено`);
  }
}

export function readInstalledFile(
  chain: readonly string[],
  relPath: string,
  fromDir = ROOT,
): string {
  const dir = installedPackageDir(chain, fromDir);
  const file = join(dir, relPath);
  if (!existsSync(file))
    throw new InstalledFileMissingError(
      chain.at(-1) as string,
      installedVersion(chain, fromDir),
      relPath,
    );
  return readFileSync(file, 'utf8');
}

export function installedVersion(
  chain: readonly string[],
  fromDir = ROOT,
): string {
  const pkg = JSON.parse(
    readFileSync(
      join(installedPackageDir(chain, fromDir), 'package.json'),
      'utf8',
    ),
  ) as { version: string };
  return pkg.version;
}
