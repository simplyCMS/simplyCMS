import type pg from 'pg';
import {
  findLanguagePack,
  listLanguagePacks,
  type LanguagePack,
} from 'simplycms/i18n/packs';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  SEED_ORDER_STATUS_CODES,
  SYSTEM_SEED_IDS,
} from 'simplycms/schema/seed-ids';

/** Колір і прапорець дефолту статусу — не залежать від мови, лише тексти. */
const STATUS_COLORS: Record<(typeof SEED_ORDER_STATUS_CODES)[number], string> =
  {
    new: '#3B82F6',
    confirmed: '#10B981',
    processing: '#F59E0B',
    shipped: '#8B5CF6',
    delivered: '#22C55E',
    cancelled: '#EF4444',
  };

/**
 * Пакет основної мови або відмова. Окремо від `bootstrapStore`, щоб `applyMigrations`
 * відхилив невідому мову ДО з'єднання (як `runtimeUrl`), а не після накату всіх файлів.
 */
export function requirePrimaryPack(primaryLocale: string): LanguagePack {
  const pack = findLanguagePack(primaryLocale);
  if (pack) return pack;
  const known = listLanguagePacks()
    .map((p) => p.code)
    .join(', ');
  throw new Error(
    `[simplycms/migrate] Для основної мови «${primaryLocale}» немає мовного пакета. Наявні: ${known}.`,
  );
}

/**
 * Старт чистої БД з основною мовою магазину (М2б, Р23): мова й довідники, чиї
 * тексти залежать від мови, — статуси замовлень, тип ціни, категорія покупця,
 * основна зона доставки, профіль магазину. `0003_seed.sql` тримає лише рядки без
 * тексту: тексти беруться з мовного пакета, тож магазин, що стартує англійською,
 * не отримує українських довідників.
 *
 * Одна транзакція під замком `languages-set` (той самий, під яким пише в
 * `languages` решта коду; без нього тригер `languages_require_lock` відмовить).
 * `languages` непорожня — база вже стартувала, нічого не пишемо: основну мову
 * далі не змінюють (`languages_guard`), а правки довідників — справа адміна.
 * Рядки довідників вставляються без `on conflict`: на порожній `languages`
 * їх не може бути, і конфлікт — сигнал зламаної бази, а не привід мовчати.
 *
 * Сирий SQL через клієнт накату, без Drizzle: модуль живе до ролей і RLS.
 *
 * @param primaryLocale код основної мови; пакет шукається за точним кодом, далі
 *   за базовою мовою (`en-GB` → `en`), а рядок мови отримує код як є.
 */
export async function bootstrapStore(
  client: pg.ClientBase,
  primaryLocale: string,
): Promise<{ seeded: boolean }> {
  const pack = requirePrimaryPack(primaryLocale);
  const seed = pack.content.seed;
  const ids = SYSTEM_SEED_IDS;
  await client.query('begin');
  try {
    await client.query(
      'select pg_advisory_xact_lock(hashtextextended($1, 0))',
      [LOCK_KEYS.languagesSet],
    );
    const { rows } = await client.query<{ filled: boolean }>(
      'select exists (select 1 from public.languages) as filled',
    );
    if (rows[0]!.filled) {
      await client.query('rollback');
      return { seeded: false };
    }
    await client.query(
      `insert into public.languages (id, code, name, status, is_default, sort_order)
       values ($1, $2, $3, 'published', true, 0)`,
      [ids.language, primaryLocale, pack.name],
    );
    for (const [index, code] of SEED_ORDER_STATUS_CODES.entries()) {
      await client.query(
        `insert into public.order_statuses (id, name, code, color, sort_order, is_default)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          ids.orderStatuses[code],
          seed.orderStatuses[code],
          code,
          STATUS_COLORS[code],
          index,
          code === 'new',
        ],
      );
    }
    await client.query(
      `insert into public.price_types (id, name, code, is_default, sort_order)
       values ($1, $2, 'retail', true, 0)`,
      [ids.priceTypeRetail, seed.priceTypeRetail],
    );
    await client.query(
      `insert into public.user_categories (id, name, code, is_default, price_type_id)
       values ($1, $2, 'retail', true, $3)`,
      [
        ids.customerCategoryRetail,
        seed.customerCategoryRetail,
        ids.priceTypeRetail,
      ],
    );
    await client.query(
      `insert into public.system_settings (id, key, value, description)
       values ($1, 'store_profile', $2::jsonb, null)`,
      [
        ids.storeProfileSetting,
        JSON.stringify({
          name: seed.storeName,
          homeTitle: null,
          description: null,
          contacts: { phone: null, email: null, address: null, hours: null },
          logo: null,
          socials: [],
        }),
      ],
    );
    await client.query(
      `insert into public.shipping_zones (id, name, is_active, is_default, sort_order)
       values ($1, $2, true, true, 0)`,
      [ids.mainShippingZone, seed.mainShippingZone],
    );
    await client.query('commit');
    return { seeded: true };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  }
}
