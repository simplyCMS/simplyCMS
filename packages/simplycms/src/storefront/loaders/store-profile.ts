import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import {
  readStoreProfile,
  storeProfileCache,
  toStorefrontProfile,
} from 'simplycms/site';
import { withStorefrontDb } from './db';

/**
 * Профіль магазину для вітрини крізь спільний кеш (покоління в БД + TTL 5 хв як верхня межа).
 *
 * Звичайна функція, не `createServerFn`: її кличуть серверні лоадери й
 * тести. Кеш узгоджує адмінка: `bumpCacheGeneration` у транзакції збереження.
 */
export function loadStoreProfile(): Promise<StorefrontProfile> {
  return storeProfileCache.get(() =>
    withStorefrontDb((db) => readStoreProfile(db)).then(toStorefrontProfile),
  );
}
