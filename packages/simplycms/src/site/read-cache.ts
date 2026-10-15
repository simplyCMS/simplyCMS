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

/** Параметри читання: `variant` — окремий запис під тим самим поколінням ключа. */
export type ReadCacheGetOptions = {
  /** Мова (чи інша вісь) запису: дві мови не діляться значенням (І36). */
  variant?: string;
};

export type ReadCache<T> = {
  /**
   * Віддати кешоване значення, якщо покоління в БД не змінилось, інакше прочитати `load`.
   * `variant` розводить записи (мови) під ОДНИМ поколінням ключа.
   */
  get(load: () => Promise<T>, opts?: ReadCacheGetOptions): Promise<T>;
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
 *
 * `get(load, { variant })` — запис на мову (І36): `load` кличеться для кожного
 * варіанта окремо, а зміна покоління скидає всі варіанти.
 */
export function createReadCache<T>(
  key: CacheKey,
  opts: { ttlMs?: number } = {},
): ReadCache<T> {
  const { ttlMs } = opts;
  if (ttlMs !== undefined && !(ttlMs > 0)) {
    throw new RangeError('[simplycms/site] TTL кешу має бути додатним числом');
  }
  // Запис на варіант (мову) під спільним поколінням ключа: зміна покоління
  // робить застарілими ВСІ варіанти одразу, бо кожен порівнює своє покоління
  // з поточним. Варіантів стільки, скільки мов — Map не росте без меж.
  const entries = new Map<
    string,
    { data: T; at: number; generation: bigint }
  >();

  return {
    async get(load, { variant = '' } = {}) {
      const generation = (await readGenerations()).get(key) ?? ZERO;
      const now = Date.now();
      const entry = entries.get(variant);
      if (
        entry &&
        entry.generation === generation &&
        (ttlMs === undefined || now - entry.at < ttlMs)
      )
        return entry.data;

      const data = await load();
      entries.set(variant, { data, at: now, generation });
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
