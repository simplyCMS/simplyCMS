// К3-Е5б, фінальне рев'ю п.2(в,г): контекст знижок нової позиції (Е5б-1,
// Е5б-6). (в) поріг «від суми» рахується від БАЗОВИХ цін наявних позицій
// (`base_price ?? price`), а не від знижених; (г) категорія покупця — окремо
// від типу ціни — вирішує, яка знижка дістанеться новій позиції. Категорію
// «VIP без типу ціни» тест заводить сам у своїй БД — демо-сід не змінюється.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useOrderItemsEditDb } from './fixtures/order-items-edit';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: знижки нової позиції замовлення (К3-Е5б, рев’ю п.2)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_discounts');
  const { ids } = f;
  let vip = '';

  beforeAll(async () => {
    // Категорія без власного типу ціни → тип ціни дефолтний (роздріб), як у
    // гостя; відрізняється від гостя ЛИШЕ категорією.
    await f.rows(
      `insert into public.user_categories (id, name, code, is_default, price_type_id)
       values (gen_random_uuid(), 'VIP', 'e5b-vip', false, null)`,
    );
    vip = (
      await f.rows<{ id: string }>(
        `insert into public.users (id, name, email, email_verified)
         values (gen_random_uuid(), 'VIP', 'e5b-vip@example.test', true) returning id`,
      )
    )[0]!.id;
    await f.rows(
      `insert into public.profiles (id, user_id, email, first_name, category_id)
       select gen_random_uuid(), $1, 'e5b-vip@example.test', 'VIP', c.id
         from public.user_categories c where c.code = 'e5b-vip'`,
      [vip],
    );
  });

  it('поріг «від суми» — від базових цін наявних позицій: знижена панель тягне склад через 50000', async () => {
    // Панель 4800 −10 % «Роздріб» = 4320. Базові: 6 × 4800 + 1234.55 =
    // 30034.55, + акумулятор 21000 = 51034.55 ≥ 50000. Знижені: 6 × 4320 +
    // 1234.55 + 21000 = 48154.55 — під порогом.
    const o = await f.place([
      { productId: ids.panel, quantity: 6 },
      { productId: ids.inverter, quantity: 1 },
    ]);
    expect(
      (await f.items(o)).find((i) => i.productId === ids.panel),
    ).toMatchObject({ price: '4320.00', quantity: 6 });
    const { upserted } = await f.add(o, ids.battery, 1);
    expect(upserted[0]).toMatchObject({
      price: '19950.00',
      basePrice: '21000.00',
      total: '19950.00',
    });
  });

  it('категорія покупця впливає на знижку нової позиції незалежно від типу ціни', async () => {
    // Гість (категорія «Роздріб» за замовчуванням) дістає −10 % на панель…
    const guest = await f.place([{ productId: ids.battery, quantity: 1 }]);
    expect((await f.add(guest, ids.panel, 1)).upserted[0]).toMatchObject({
      price: '4320.00',
      basePrice: '4800.00',
    });
    // …а VIP з тим самим (дефолтним) типом ціни — ні: умова знижки —
    // категорія «Роздріб», якої в нього немає.
    const own = await f.place([{ productId: ids.battery, quantity: 1 }], {
      userId: vip,
    });
    const { upserted } = await f.add(own, ids.panel, 1);
    expect(upserted[0]).toMatchObject({
      price: '4800.00',
      basePrice: null,
      discountData: null,
    });
  });
});
