// Ліс знижок зі сховища (К3-Е6в, Е6в-8) крізь `priceItems` — те, що лягає в
// замовлення. Кожен кейс починає з порожніх правил: оператори груп мають
// оцінюватись без чужих акцій поруч.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { loadDiscountRules, priceItems } from 'simplycms/commerce';
import { discountEnvironmentFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';
import {
  discountGroupStatement,
  percentDiscountStatements,
  type PercentDiscountSpec,
} from './fixtures/discounts';

/** Товар без власних акцій у фікстурах контуру; база тут — рівно 1000. */
const PRODUCT = F.INVERTER_8KW;
const target = { type: 'product', id: PRODUCT } as const;

type Priced = Awaited<ReturnType<typeof priceItems>>;
const only = (out: Priced) => {
  if (out === 'not_purchasable') throw new Error(out);
  return out[0];
};
const appliedOf = (out: Priced) => {
  const data = only(out).discountData as {
    applied: { name: string; calculatedAmount: number }[];
  } | null;
  return data?.applied.map((a) => [a.name, a.calculatedAmount]) ?? null;
};

describe('ліс знижок зі сховища → priceItems', () => {
  const db = useCommerceDb('simplycms_discount_forest');
  const seed = async (statements: string[]) => {
    for (const s of statements) await db.run(s);
  };
  const discount = (s: Omit<PercentDiscountSpec, 'target'>) =>
    percentDiscountStatements({ ...s, target });
  const priceGuest = () => guest((tx) => priceItems(tx, null, [line(PRODUCT)]));

  beforeAll(async () => {
    await db.run(
      `update public.product_prices set price = 1000
        where product_id = '${PRODUCT}' and modification_id is null
          and price_type_id = (select id from public.price_types where code = 'retail')`,
    );
  });
  beforeEach(async () => {
    // Каскад FK забирає знижки, цілі, умови й дочірні групи.
    await db.run('delete from public.discount_groups');
  });

  it('🔴 неактивна група прибирає піддерево: активна знижка в дочірній групі не діє', async () => {
    await seed([
      discountGroupStatement({ name: 'Вимкнений батько', isActive: false }),
      ...discount({
        group: 'Дитина',
        parentGroup: 'Вимкнений батько',
        name: 'Дитяча −10%',
        percent: 10,
      }),
    ]);
    const item = only(await priceGuest());
    expect(item).toMatchObject({ price: 1000, basePrice: null });
    expect(item.discountData).toBeNull();
  });

  it('🔴 середовище вітрини: вимкнена група з активною дитиною не йде в браузер', async () => {
    await seed([
      discountGroupStatement({ name: 'Вимкнена акція', isActive: false }),
      ...discount({
        group: 'Активна дитина',
        parentGroup: 'Вимкнена акція',
        name: 'Таємна −10%',
        percent: 10,
      }),
      // Позитивний контроль: порожній ліс не має пройти «за будь-якого коду».
      ...discount({
        group: 'Відкрита акція',
        name: 'Усім −5%',
        percent: 5,
        priceTypeCode: null,
      }),
    ]);
    for (const userId of [null, db.wholesale]) {
      const env = await discountEnvironmentFor(userId);
      expect(env.forest.map((g) => g.name)).toEqual(['Відкрита акція']);
      const wire = JSON.stringify(env);
      for (const name of ['Вимкнена акція', 'Активна дитина', 'Таємна −10%'])
        expect(wire).not.toContain(name);
    }
  });

  it('знижка з price_type_id NULL діє і для «опту», і для гостя з «роздробом»', async () => {
    await seed(
      discount({
        group: 'Для всіх типів',
        name: 'Усім −10%',
        percent: 10,
        priceTypeCode: null,
      }),
    );
    expect(only(await priceGuest())).toMatchObject({ price: 900 });
    const wholesale = await withActor(
      { role: 'app_user', userId: db.wholesale },
      (tx) => priceItems(tx, db.wholesale, [line(PRODUCT)]),
    );
    // Гуртовик не має своєї ціни на товар — база з дефолтного типу.
    expect(only(wholesale)).toMatchObject({ price: 900, basePrice: 1000 });
  });

  const pair = (operator: PercentDiscountSpec['operator']) => [
    ...discount({ group: 'Пара', operator, name: 'Десять', percent: 10 }),
    ...discount({ group: 'Пара', name: 'Двадцять', percent: 20, priority: 1 }),
  ];

  it.each([
    [
      'and',
      700,
      [
        ['Десять', 100],
        ['Двадцять', 200],
      ],
    ],
    ['or', 900, [['Десять', 100]]],
    ['min', 900, [['Десять', 100]]],
    ['max', 800, [['Двадцять', 200]]],
  ] as const)(
    'оператор %s: discount_data.applied — лише те, що увійшло в суму',
    async (operator, price, applied) => {
      await seed(pair(operator));
      const out = await priceGuest();
      expect(only(out).price).toBe(price);
      expect(appliedOf(out)).toEqual(applied);
    },
  );

  it('оператор not: жодної знижки, discount_data = null, ціна 1000', async () => {
    await seed(pair('not'));
    const item = only(await priceGuest());
    expect(item).toMatchObject({ price: 1000, basePrice: null });
    expect(item.discountData).toBeNull();
  });

  it('max із дочірньою групою-програвшою: її знижок в applied немає', async () => {
    await seed([
      ...discount({
        group: 'Макс',
        operator: 'max',
        name: 'Пряма −20%',
        percent: 20,
      }),
      ...discount({
        group: 'Програвша',
        parentGroup: 'Макс',
        name: 'Дочірня −10%',
        percent: 10,
      }),
    ]);
    const out = await priceGuest();
    expect(only(out).price).toBe(800);
    expect(appliedOf(out)).toEqual([['Пряма −20%', 200]]);
  });

  it('межа «БД → домен» на живому Postgres: дата — Date, numeric — число', async () => {
    await seed(discount({ group: 'Дати', name: 'Дробова', percent: 12.5 }));
    await db.run(
      `update public.discounts set starts_at = '2026-03-29T00:30:00+00:00'`,
    );
    const rules = await guest(loadDiscountRules);
    const [d] = rules.discounts;
    expect(d.discount_value).toBe(12.5);
    expect(d.starts_at?.getTime()).toBe(Date.UTC(2026, 2, 29, 0, 30));
    expect(rules.groups.map((g) => g.name)).toEqual(['Дати']);
  });
});
