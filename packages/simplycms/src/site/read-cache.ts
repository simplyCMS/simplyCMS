import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import type { JsonValue, Theme } from 'simplycms/schema/types';
import type { LanguageSummary } from './languages';
import {
  CACHE_KEYS,
  readGenerations,
  type CacheKey,
} from './cache-generations';

/** Запис активної теми у формі, яку читають каркасні роути. */
export interface ThemeRecord {
  id: Theme['id'];
  name: Theme['name'];
  display_name: Theme['displayName'];
  version: Theme['version'];
  description: Theme['description'];
  author: Theme['author'];
  preview_image: Theme['previewImage'];
  is_active: Theme['isActive'];
  settings: Record<string, JsonValue>;
  created_at: Date;
  updated_at: Date;
}

export type ReadCache<T> = {
  /** Віддати кешоване значення, якщо покоління в БД не змінилось, інакше прочитати `load`. */
  get(load: () => Promise<T>): Promise<T>;
};

/**
 * Кеш читання, узгоджений між репліками через `cache_generations` (Д6).
 *
 * `get` порівнює покоління запису з поточним у БД і перечитує лише при зміні:
 * мутація (будь-якої репліки) збільшує покоління у своїй транзакції, тож інші
 * репліки бачать її на наступному запиті, не чекаючи TTL. Процесного
 * `invalidate()` немає навмисно — він скидав би кеш лише в одному процесі.
 * `ttlMs` — необовʼязкова ВЕРХНЯ межа свіжості (страховка від зміни, що не
 * піднімає покоління), а не механізм узгодження.
 *
 * 🔴 Покоління читається ДО `load` і зберігається разом зі значенням. Читання,
 * що стартувало до мутації й завершилось після, кладе в кеш старе значення зі
 * СТАРИМ поколінням — і наступний `get` бачить розбіжність та перечитує (Е6б:
 * власник зберіг, вітрина не бачить). Запис ЗАМІНЮЄТЬСЯ завжди, а не лише на
 * більше покоління: порівняння `>=` вимкнуло б кеш після відновлення БД з
 * бекапу при живому процесі (запис 7, у БД знову 3 — кеш мовчав би до 4 bump-ів
 * і віддавав дані до відновлення). Повільне читання зі старішим поколінням
 * коштує одного зайвого перечитування, не помилки. Помилку `load` не кешуємо.
 */
export function createReadCache<T>(
  key: CacheKey,
  opts: { ttlMs?: number } = {},
): ReadCache<T> {
  const { ttlMs } = opts;
  if (ttlMs !== undefined && !(ttlMs > 0)) {
    throw new RangeError('[simplycms/site] TTL кешу має бути додатним числом');
  }
  let entry: { data: T; at: number; generation: bigint } | null = null;

  return {
    async get(load) {
      const generation = (await readGenerations()).get(key) ?? ZERO;
      const now = Date.now();
      if (
        entry &&
        entry.generation === generation &&
        (ttlMs === undefined || now - entry.at < ttlMs)
      )
        return entry.data;

      const data = await load();
      entry = { data, at: now, generation };
      return data;
    },
  };
}

// Літерал `0n` недоступний за target tsconfig пакета (< ES2020).
const ZERO = BigInt(0);

const CACHE_TTL_MS = 5 * 60 * 1000;

// Один екземпляр на процес: вітрина читає, узгодження — через покоління в БД.
export const storeProfileCache: ReadCache<StorefrontProfile> = createReadCache(
  CACHE_KEYS.storeProfile,
  { ttlMs: CACHE_TTL_MS },
);
export const activeThemeCache: ReadCache<ThemeRecord | null> = createReadCache(
  CACHE_KEYS.activeTheme,
  { ttlMs: CACHE_TTL_MS },
);
// Набір мов (М1, Task 6): його змінюють лише операції мов, кожна піднімає покоління.
export const languagesCache: ReadCache<LanguageSummary[]> = createReadCache(
  CACHE_KEYS.languages,
  { ttlMs: CACHE_TTL_MS },
);
