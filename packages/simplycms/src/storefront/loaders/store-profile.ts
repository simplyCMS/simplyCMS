import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import {
  readStoreProfile,
  storeProfileCache,
  toStorefrontProfile,
} from 'simplycms/site';
import { withStorefrontDb } from './db';

/**
 * Профіль магазину для вітрини крізь спільний кеш (TTL 5 хв + покоління).
 *
 * Звичайна функція, не `createServerFn`: її кличуть серверні лоадери й
 * тести. Скидає кеш адмінка (`storeProfileCache.invalidate()` після COMMIT).
 */
export function loadStoreProfile(): Promise<StorefrontProfile> {
  return storeProfileCache.get(() =>
    withStorefrontDb((db) => readStoreProfile(db)).then(toStorefrontProfile),
  );
}
