import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import type { JsonValue, Theme } from 'simplycms/schema/types';

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
  /** Віддати кешоване значення в межах TTL, інакше прочитати `load`. */
  get(load: () => Promise<T>): Promise<T>;
  /** Скинути кеш і анулювати читання, що вже в польоті. */
  invalidate(): void;
};

/**
 * Процесний кеш читання з TTL і лічильником поколінь.
 *
 * 🔴 Покоління потрібне, бо читання, що стартувало ДО скидання, а завершилось
 * ПІСЛЯ нього, поклало б у кеш старе значення ще на весь TTL: власник зберіг,
 * а вітрина не бачить, і жодної помилки немає. Тому результат кешується, лише
 * якщо покоління на старті читання збігається з поточним. Помилку `load`
 * не кешуємо й пропускаємо далі: збій БД на секунду не має ставати «значенням»
 * на пʼять хвилин.
 */
export function createReadCache<T>(ttlMs: number): ReadCache<T> {
  if (!(ttlMs > 0)) {
    throw new RangeError('[simplycms/site] TTL кешу має бути додатним числом');
  }
  let entry: { data: T; at: number } | null = null;
  let generation = 0;

  return {
    async get(load) {
      const now = Date.now();
      if (entry && now - entry.at < ttlMs) return entry.data;

      const startedAt = generation;
      const data = await load();
      if (startedAt === generation) entry = { data, at: now };
      return data;
    },
    invalidate() {
      generation += 1;
      entry = null;
    },
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// Один екземпляр на процес: вітрина читає, адмінка скидає після COMMIT.
export const storeProfileCache: ReadCache<StorefrontProfile> =
  createReadCache(CACHE_TTL_MS);
export const activeThemeCache: ReadCache<ThemeRecord | null> =
  createReadCache(CACHE_TTL_MS);
