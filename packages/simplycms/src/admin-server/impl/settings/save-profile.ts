import { and, eq } from 'drizzle-orm';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import {
  STORE_PROFILE_KEY,
  type StoreProfile,
} from 'simplycms/contracts/store-profile';
import type { ActorDb } from 'simplycms/db';
import {
  STORE_LOGO_OWNER_ID,
  type MediaEntityType,
} from 'simplycms/domain/media';
import { media, systemSettings } from 'simplycms/schema';
import { readStoreProfile, storeProfileCache } from 'simplycms/site';
import { completeMediaErasures, eraseMediaRows } from 'simplycms/storage';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { lockCatalogTarget } from '../catalog-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { storeProfileInput, type StoreProfileInput } from './profile-schema';

/**
 * Тип рядка `media`, яким може бути логотип (Е6б-14). `satisfies` привʼязує
 * літерал до allowlist T1: перейменування там зламає typecheck тут.
 */
const STORE_LOGO = 'store_logo' satisfies MediaEntityType;

/**
 * Advisory-ключ запису профілю: дві вкладки, що міняють логотип одночасно,
 * обидві прочитали б той самий «попередній» і одна з нових лишилась би
 * сиротою. `FOR UPDATE` рядка не годиться — рядка може не бути (upsert).
 */
export const STORE_PROFILE_LOCK = LOCK_KEYS.storeProfile;

/**
 * Чи референс — рядок `media` саме логотипа: тип І власник (К3-Е6д-3), щоб
 * файл з тим самим типом, але чужим `entity_id`, не пройшов. `for share` — не
 * зникне до COMMIT.
 */
async function isStoreLogo(db: ActorDb, ref: string): Promise<boolean> {
  const query = db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        eq(media.storageKey, ref),
        eq(media.entityType, STORE_LOGO),
        eq(media.entityId, STORE_LOGO_OWNER_ID),
      ),
    )
    .limit(1);
  return (await query.for('share')).length === 1;
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
 * 4. Рядок старого логотипа видаляє `eraseMediaRows` у цій же транзакції
 *    (разом із рядком outbox), файл стирає `completeMediaErasures` ПІСЛЯ COMMIT
 *    (Е6д-14): відмова COMMIT не лишає профіль із посиланням на стертий файл.
 *    Власник `store_logo/STORE_LOGO_OWNER_ID` звіряється самим стиранням:
 *    зіпсований ручним SQL профіль не має права стерти фото товару.
 *
 * Кеш вітрини скидається ПІСЛЯ `runAdmin` (після COMMIT, Е6б-9).
 */
export const saveStoreProfileOp = async ({
  data,
}: {
  data: StoreProfileInput;
}): Promise<StoreProfile> => {
  const profile = parseAdminInput(storeProfileInput, data);
  const { saved, erased } = await runAdmin('settings.manage', async (db) => {
    await lockCatalogTarget(db, STORE_PROFILE_LOCK);
    const previous = (await readStoreProfile(db)).logo;
    if (profile.logo !== null && !(await isStoreLogo(db, profile.logo)))
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

    const erased =
      previous !== null && previous !== profile.logo
        ? await eraseMediaRows(db, [previous], {
            entityType: STORE_LOGO,
            entityId: STORE_LOGO_OWNER_ID,
          })
        : [];
    return { saved: profile, erased };
  });
  storeProfileCache.invalidate();
  await completeMediaErasures(erased);
  return saved;
};
