// Фінальне рев'ю К3-Е6в, F5: тип ціни — тип КАТЕГОРІЇ покупця (Е6в-19:
// гість і профіль з `category_id NULL` належать ДЕФОЛТНІЙ категорії); якщо
// в категорії типу немає — глобальний дефолтний тип. Одне правило для всього,
// що живе з `loadPricingContext`: середовище картки, квота кошика, чек.
import { beforeAll, describe, expect, it } from 'vitest';
import { priceItems } from 'simplycms/commerce';
import {
  discountEnvironmentFor,
  quoteCartFor,
  withCustomerDb,
} from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';

const PRODUCT = F.STATION_10KWH;
const WHOLESALE_TYPE = 'c0000002-0000-4000-8000-000000000001';
const RETAIL_TYPE = '00000003-0000-4000-8000-000000000001';
const DEFAULT_CATEGORY = '00000004-0000-4000-8000-000000000001';
const BARE_CATEGORY = 'c0000005-0000-4000-8000-000000000001';

describe('тип ціни — з категорії покупця, NULL-профіль і гість — з дефолтної (F5)', () => {
  const db = useCommerceDb('simplycms_default_category_price_type');
  const users = { nullProfile: '', bare: '' };
  const seedUser = async (email: string, categoryId: string | null) => {
    await db.run(
      `insert into public.users (name, email, email_verified) values ('F5', '${email}', true)`,
    );
    const [u] = (await db.run(
      `select id from public.users where email = '${email}'`,
    )) as { id: string }[];
    await db.run(
      `insert into public.profiles (id, user_id, email, first_name, category_id)
       values (gen_random_uuid(), '${u.id}', '${email}', 'F5', ${categoryId ? `'${categoryId}'` : 'null'})`,
    );
    return u.id;
  };

  beforeAll(async () => {
    // Дефолтна категорія — з гуртовим типом, відмінним від глобального.
    await db.run(
      `update public.user_categories set price_type_id = '${WHOLESALE_TYPE}' where id = '${DEFAULT_CATEGORY}'`,
    );
    await db.run(
      `insert into public.user_categories (id, name, code, is_default, price_type_id)
       values ('${BARE_CATEGORY}', 'Без типу', 'f5-bare', false, null)`,
    );
    users.nullProfile = await seedUser('f5-null@example.test', null);
    users.bare = await seedUser('f5-bare@example.test', BARE_CATEGORY);
  });

  const retailPrice = async () =>
    (
      (await db.run(
        `select price::float as p from public.product_prices
          where product_id = '${PRODUCT}' and modification_id is null
            and price_type_id = '${RETAIL_TYPE}'`,
      )) as { p: number }[]
    )[0].p;

  /** Тип середовища, база рядка квоти й ціна чеку для актора. */
  const observe = async (userId: string | null) => {
    const env = await discountEnvironmentFor(userId);
    const quote = await quoteCartFor([line(PRODUCT)], userId);
    const priced = await (userId
      ? withCustomerDb(userId, (tx) => priceItems(tx, userId, [line(PRODUCT)]))
      : guest((tx) => priceItems(tx, null, [line(PRODUCT)])));
    const first = quote.lines[0];
    if (!first.available || priced === 'not_purchasable')
      throw new Error('недоступний');
    return {
      priceTypeId: env.priceTypeId,
      quoteBase: first.basePrice,
      checkout: priced[0].price,
    };
  };

  it.each([
    ['гість', () => null],
    ['профіль з category_id NULL', () => users.nullProfile],
  ])('%s → тип і ціна дефолтної категорії', async (_who, who) => {
    expect(await observe(who())).toEqual({
      priceTypeId: WHOLESALE_TYPE,
      quoteBase: F.WHOLESALE_STATION_PRICE,
      checkout: F.WHOLESALE_STATION_PRICE,
    });
  });

  it('категорія без типу → глобальний дефолтний тип (не тип дефолтної категорії)', async () => {
    const retail = await retailPrice();
    expect(retail).not.toBe(F.WHOLESALE_STATION_PRICE);
    expect(await observe(users.bare)).toEqual({
      priceTypeId: RETAIL_TYPE,
      quoteBase: retail,
      checkout: retail,
    });
  });
});
