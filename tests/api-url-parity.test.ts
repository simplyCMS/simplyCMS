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

/** Код репозиторію, у якому шукаємо `fetch('/api/…')`. */
const CODE_PATHSPECS = ['*.ts', '*.tsx', ':!**/routeTree.gen.ts', ':!tests/**'];

/**
 * Самоперевірка механіки grep: цей файл свідомо містить зразок нижче, і
 * пошук по ньому мусить його знайти. Зразок резолвиться у справжній роут.
 *   fetch('/api/health')
 */
const SELF_CHECK_PATHSPECS = ['tests/api-url-parity.test.ts'];

/** Усі `fetch('/api/…')` у pathspec-ах (включно з untracked-файлами). */
function collectFetchedApiPaths(pathspecs: string[]): string[] {
  const args = [
    'grep',
    '--untracked',
    '-ohE',
    String.raw`fetch\(\s*['"\`]/api/[a-zA-Z0-9/_-]+`,
    '--',
    ...pathspecs,
  ];
  let raw = '';
  try {
    raw = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  } catch (error) {
    // `git grep` без збігів виходить з кодом 1 — це порожній результат, а не
    // збій. З К3-Е6б (знесено `/api/revalidate-theme`) код ядра не робить
    // жодного `fetch('/api/…')`: адмінка ходить serverFn-ами. Будь-який інший
    // код виходу — справжня поломка, її не ковтаємо.
    if ((error as { status?: number }).status !== 1) throw error;
  }
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
  const apiPaths = collectFetchedApiPaths(CODE_PATHSPECS);

  it('теки роутів із routes.ts існують', () => {
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) expect(existsSync(dir)).toBe(true);
  });

  it('гард не порожній — той самий grep знаходить зразок і резолвить його', () => {
    // Інакше зламаний grep мовчки перетворив би цей файл на no-op. Раніше це
    // доводив живий `fetch` адмінки; з К3-Е6б його немає, тож механіку
    // перевіряє зразок у цьому файлі (SELF_CHECK_PATHSPECS).
    const sample = collectFetchedApiPaths(SELF_CHECK_PATHSPECS);
    expect(sample).toEqual(['/api/health']);
    expect(routeFileFor(sample[0]!, dirs)).not.toBeNull();
  });

  it('кожен /api-URL із коду резолвиться у файл роуту', () => {
    const dangling = apiPaths.filter((path) => !routeFileFor(path, dirs));
    expect(dangling).toEqual([]);
  });
});
