import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';

/**
 * Паритет URL: кожен `fetch('/api/…')` у коді має відповідати наявному файлу
 * роуту в змонтованих теках. Без цього гарду мертвий URL (як старий
 * `/api/revalidate`) живе в коді роками: юніт-тест кличе обробник напряму й
 * зеленіє, а адмінка стукає в 404.
 *
 * Теки роутів беруться з `routes.ts` (джерело правди `virtualRouteConfig`),
 * тому переїзд ендпойнта між пакетами гард не ламає.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** `physical()` у `routes.ts` рахує шляхи від `routesDirectory` = `src/routes`. */
const ROUTES_DIRECTORY = join(ROOT, 'src', 'routes');

/** Теки роутів, змонтовані у віртуальний конфіг. */
function mountedRouteDirs(): string[] {
  const children = routes.children ?? [];
  return children
    .filter((child) => child.type === 'physical')
    .map((child) => resolve(ROUTES_DIRECTORY, child.directory));
}

/** Усі `fetch('/api/…')` у коді репозиторію (включно з untracked-файлами). */
function collectFetchedApiPaths(): string[] {
  const args = [
    'grep',
    '--untracked',
    '-ohE',
    String.raw`fetch\(\s*['"\`]/api/[a-zA-Z0-9/_-]+`,
    '--',
    '*.ts',
    '*.tsx',
    ':!**/routeTree.gen.ts',
    ':!tests/**',
  ];
  const raw = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const paths = new Set<string>();
  for (const line of raw.split('\n')) {
    const match = line.match(/\/api\/[a-zA-Z0-9/_-]+/);
    if (match) paths.add(match[0]);
  }
  return [...paths].sort();
}

/** Чи існує файл роуту для URL (`/api/x` → `api/x.tsx` | `api/x/index.tsx`). */
function routeFileFor(urlPath: string, dirs: string[]): string | null {
  const relative = urlPath.replace(/^\//, '');
  for (const dir of dirs) {
    for (const candidate of [
      `${relative}.tsx`,
      `${relative}.ts`,
      join(relative, 'index.tsx'),
      join(relative, 'index.ts'),
    ]) {
      const full = join(dir, candidate);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

describe('паритет URL: fetch(/api/…) ↔ файли роутів', () => {
  const dirs = mountedRouteDirs();
  const apiPaths = collectFetchedApiPaths();

  it('теки роутів із routes.ts існують', () => {
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) expect(existsSync(dir)).toBe(true);
  });

  it('гард не порожній — принаймні один /api-виклик у коді знайдено', () => {
    // Інакше зламаний grep мовчки перетворив би цей файл на no-op.
    expect(apiPaths.length).toBeGreaterThan(0);
  });

  it('кожен /api-URL із коду резолвиться у файл роуту', () => {
    const dangling = apiPaths.filter((path) => !routeFileFor(path, dirs));
    expect(dangling).toEqual([]);
  });
});
