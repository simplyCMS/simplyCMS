import { eq } from 'drizzle-orm';
import {
  STORE_PROFILE_KEY,
  type StorefrontProfile,
  type StoreProfile,
} from 'simplycms/contracts/store-profile';
import type { ActorDb } from 'simplycms/db';
import { resolveMediaUrl } from 'simplycms/domain/media';
import {
  EMPTY_STORE_PROFILE,
  parseStoreProfile,
} from 'simplycms/domain/store-profile';
import { systemSettings } from 'simplycms/schema';

/**
 * Профіль магазину з `system_settings`. Рядка немає або значення зіпсоване —
 * порожній профіль, а не помилка: вітрина не має падати через ручний SQL.
 * Власного каналу до БД немає — транзакцію відкриває викликач.
 */
export async function readStoreProfile(db: ActorDb): Promise<StoreProfile> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, STORE_PROFILE_KEY))
    .limit(1);
  return row ? parseStoreProfile(row.value) : EMPTY_STORE_PROFILE;
}

/** Референс логотипа з порту сховища → URL для вітрини. */
export function toStorefrontProfile(p: StoreProfile): StorefrontProfile {
  const { logo, ...rest } = p;
  return { ...rest, logoUrl: resolveMediaUrl(logo) };
}
