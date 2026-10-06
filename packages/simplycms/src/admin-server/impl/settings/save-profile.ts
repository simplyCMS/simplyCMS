import { and, eq } from 'drizzle-orm';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import {
  STORE_PROFILE_KEY,
  type StoreProfile,
} from 'simplycms/contracts/store-profile';
import type { ActorDb } from 'simplycms/db';
import { media, systemSettings } from 'simplycms/schema';
import { readStoreProfile, storeProfileCache } from 'simplycms/site';
import { eraseMedia } from 'simplycms/storage';
import { lockCatalogTarget } from '../catalog-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { storeProfileInput, type StoreProfileInput } from './profile-schema';

/** Тип рядка `media`, яким може бути логотип (Е6б-14). */
const STORE_LOGO = 'store_logo';

/**
 * Advisory-ключ запису профілю: дві вкладки, що міняють логотип одночасно,
 * обидві прочитали б той самий «попередній» і одна з нових лишилась би
 * сиротою. `FOR UPDATE` рядка не годиться — рядка може не бути (upsert).
 */
export const STORE_PROFILE_LOCK = 'store-profile';

/** Чи референс — рядок `media` саме логотипа (`for share` — не зникне до COMMIT). */
async function isStoreLogo(
  db: ActorDb,
  ref: string,
  lock: boolean,
): Promise<boolean> {
  const query = db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.storageKey, ref), eq(media.entityType, STORE_LOGO)))
    .limit(1);
  return (await (lock ? query.for('share') : query)).length === 1;
}

/**
 * Запис профілю магазину (Е6б-14, Е6б-21). Порядок у ОДНІЙ транзакції:
 *
 * 1. Лок `store-profile` — першим запитом.
 * 2. Новий `logo` — або `null`, або `media.storage_key` з `entity_type =
 *    'store_logo'`. Зовнішній URL чи чужий референс (фото товару) →
 *    `store_logo_invalid`, 409: `resolveMediaUrl` пропустив би `https:` як є,
 *    а референс товару стер би чуже фото при наступній заміні.
 * 3. Upsert рядка (`id` генерує викликач — Категорія A).
 * 4. Старий логотип стирається ОСТАННІМ — необоротна дія одразу перед
 *    COMMIT (прецедент `storefront/loaders/avatar.ts`): відмова раніше
 *    відкотила б рядок, але не повернула б файл. Стирається лише рядок саме
 *    логотипа: зіпсований ручним SQL профіль не має права стерти фото товару.
 *
 * Кеш вітрини скидається ПІСЛЯ `runAdmin` (після COMMIT, Е6б-9).
 */
export const saveStoreProfileOp = async ({
  data,
}: {
  data: StoreProfileInput;
}): Promise<StoreProfile> => {
  const profile = parseAdminInput(storeProfileInput, data);
  const saved = await runAdmin('settings.manage', async (db) => {
    await lockCatalogTarget(db, STORE_PROFILE_LOCK);
    const previous = (await readStoreProfile(db)).logo;
    if (profile.logo !== null && !(await isStoreLogo(db, profile.logo, true)))
      stateConflict(ADMIN_STATE_CONSTRAINT.storeLogoInvalid);

    await db
      .insert(systemSettings)
      .values({
        id: crypto.randomUUID(),
        key: STORE_PROFILE_KEY,
        value: profile,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: profile, updatedAt: new Date() },
      });

    if (
      previous !== null &&
      previous !== profile.logo &&
      (await isStoreLogo(db, previous, false))
    )
      await eraseMedia(db, previous);
    return profile;
  });
  storeProfileCache.invalidate();
  return saved;
};
