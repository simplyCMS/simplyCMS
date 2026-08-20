/**
 * Живі метрики лендінга — читаються КЛІЄНТОМ напряму з публічних API GitHub
 * і npm при відкритті сторінки (обидва реєстри віддають CORS `*`). Жодного
 * власного бекенда: кожен відвідувач витрачає власний rate-limit.
 *
 * Чисті функції агрегації винесені сюди окремо від React-хука, щоб їх
 * покривав звичайний vitest-прогін монорепо (tests/www-live-stats.test.ts).
 */

export const GITHUB_REPO = 'simplyCMS/simplyCMS';
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const NPM_ORG_URL = 'https://www.npmjs.com/org/simplycms';
export const NPM_SEARCH_URL =
  'https://www.npmjs.com/search?q=%40simplycms%20create-simplycms-store';

/** Unscoped-пакети платформи поза scope `@simplycms` (флагман і скаффолдер). */
const UNSCOPED_PACKAGES = new Set(['simplycms', 'create-simplycms-store']);

export interface NpmSearchObject {
  package: { name: string; version: string };
  downloads?: { monthly?: number; weekly?: number };
}

export interface NpmStats {
  packageCount: number;
  monthlyDownloads: number | null;
  version: string | null;
  /** Імена пакетів із downloads — сировина для живого тікера. */
  packages: Array<{ name: string; version: string; monthly: number | null }>;
}

export interface GitHubStats {
  stars: number;
  forks: number;
  openIssues: number;
}

export interface LiveStats {
  github: GitHubStats | null;
  npm: NpmStats | null;
  /** Частка TypeScript у репо, 0..100 (з /languages), або null. */
  tsShare: number | null;
}

/** Пакет належить платформі: scope `@simplycms/*` або відомий unscoped. */
export function isPlatformPackage(name: string): boolean {
  return name.startsWith('@simplycms/') || UNSCOPED_PACKAGES.has(name);
}

/**
 * Агрегація відповіді `registry.npmjs.org/-/v1/search?text=simplycms`.
 * Версія у всіх пакетів платформи синхронна (реліз-потяг) — беремо
 * найчастішу, щоб одиничний хвіст CDN-кеша не зіпсував заголовок.
 */
export function aggregateNpmSearch(objects: NpmSearchObject[]): NpmStats {
  const ours = objects.filter((o) => isPlatformPackage(o.package.name));

  const packages = ours.map((o) => ({
    name: o.package.name,
    version: o.package.version,
    monthly:
      typeof o.downloads?.monthly === 'number' ? o.downloads.monthly : null,
  }));

  const withDownloads = packages.filter((p) => p.monthly !== null);
  const monthlyDownloads =
    withDownloads.length > 0
      ? withDownloads.reduce((sum, p) => sum + (p.monthly ?? 0), 0)
      : null;

  const versionVotes = new Map<string, number>();
  for (const p of packages) {
    versionVotes.set(p.version, (versionVotes.get(p.version) ?? 0) + 1);
  }
  let version: string | null = null;
  let best = 0;
  for (const [v, votes] of versionVotes) {
    if (votes > best) {
      best = votes;
      version = v;
    }
  }

  return { packageCount: packages.length, monthlyDownloads, version, packages };
}

/** Частка TypeScript із відповіді GitHub `/languages` (байти по мовах). */
export function computeTsShare(
  languages: Record<string, number>,
): number | null {
  const entries = Object.entries(languages);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total <= 0) return null;
  const ts = languages['TypeScript'] ?? 0;
  return Math.round((ts / total) * 1000) / 10;
}

/** 15429 → "15,429" (en-US, tabular-думка лендінга — повні числа, не 15k). */
export function formatGrouped(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Скелетон тієї ж ширини, що майбутнє число: 15429 → "00,000". */
export function skeletonFor(n: number): string {
  return formatGrouped(n).replace(/\d/g, '0');
}

const SEARCH_ENDPOINT =
  'https://registry.npmjs.org/-/v1/search?text=simplycms&size=250';
const REPO_ENDPOINT = `https://api.github.com/repos/${GITHUB_REPO}`;
const LANGUAGES_ENDPOINT = `https://api.github.com/repos/${GITHUB_REPO}/languages`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Тягне всі три джерела паралельно; кожне падає незалежно (Promise.allSettled)
 * — сторінка показує те, що вдалося дістати, і фолбеки для решти.
 */
export async function fetchLiveStats(): Promise<LiveStats> {
  const [repo, languages, search] = await Promise.allSettled([
    fetchJson<{
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
    }>(REPO_ENDPOINT),
    fetchJson<Record<string, number>>(LANGUAGES_ENDPOINT),
    fetchJson<{ objects: NpmSearchObject[] }>(SEARCH_ENDPOINT),
  ]);

  return {
    github:
      repo.status === 'fulfilled'
        ? {
            stars: repo.value.stargazers_count,
            forks: repo.value.forks_count,
            openIssues: repo.value.open_issues_count,
          }
        : null,
    tsShare:
      languages.status === 'fulfilled' ? computeTsShare(languages.value) : null,
    npm:
      search.status === 'fulfilled'
        ? aggregateNpmSearch(search.value.objects)
        : null,
  };
}

/**
 * Фолбеки — знімок на момент останнього білда лендінга. Використовуються
 * ЛИШЕ доки живі значення не приїхали (або якщо API недоступні), і в UI
 * позначаються як приблизні. Джерело правди — завжди рантайм-фетч.
 */
export const FALLBACK: LiveStats = {
  github: { stars: 0, forks: 0, openIssues: 1 },
  tsShare: null,
  npm: {
    packageCount: 26,
    monthlyDownloads: 15429,
    version: '0.3.0',
    packages: [],
  },
};
