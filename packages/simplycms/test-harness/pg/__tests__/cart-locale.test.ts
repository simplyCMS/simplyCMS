// М1 Task 16: назва позиції кошика, квоти й знімка `order_items.name` — мовою запиту
// (товар з проєкції, модифікація з fallback на основну мову), на живому Postgres.
// Двомовний знімок і `orders.locale` — М2: тут знімок одномовний.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  placeOrderFor,
  quoteCartFor,
  quoteCheckoutFor,
} from 'simplycms/storefront/loaders';
import { useCommerceDb, line } from './fixtures/commerce-db';
import { orderInput } from './fixtures/orders';
import { poll } from './fixtures/poll';
import { productGraphSql } from './fixtures/product-graph';
import { EN, UK } from './fixtures/text-locale';

describe('назва позиції кошика й знімка мовою запиту (Task 16)', () => {
  const db = useCommerceDb('simplycms_cart_locale');
  const product = randomUUID();
  const red = randomUUID();
  const blue = randomUUID();

  beforeAll(async () => {
    await db.language('en');
    await db.run(
      productGraphSql({
        id: product,
        slug: 'kabel-lokalizatsii',
        name: 'Кабель',
        translations: { en: { name: 'Cable' } },
        isActive: true,
        hasModifications: true,
        stockStatus: 'in_stock',
        modifications: [
          {
            id: red,
            slug: 'chervonyi',
            name: 'Червоний',
            isDefault: true,
            translations: { en: { name: 'Red' } },
          },
          // Без англійської назви: модифікація читається основною мовою (fallback).
          { id: blue, slug: 'synii', name: 'Синій' },
        ],
      }),
    );
    for (const mod of [red, blue, null])
      await db.run(
        `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
         select gen_random_uuid(), t.id, '${product}', ${mod ? `'${mod}'` : 'null'}, 100
           from public.price_types t where t.is_default`,
      );
  });

  const names = async (text: typeof UK, mod: string | null) => {
    const quote = await quoteCartFor([line(product, 1, mod)], null, text);
    const first = quote.lines[0]!;
    if (!first.available) throw new Error('позиція недоступна');
    return first.name;
  };

  it('кошик на /en: назва позиції en', async () => {
    expect(await names(EN, red)).toBe('Cable - Red');
    expect(await names(UK, red)).toBe('Кабель - Червоний');
  });

  it('модифікація без англійської назви — основною мовою, товар — англійською', async () => {
    expect(await names(EN, blue)).toBe('Cable - Синій');
  });

  it('позиція без модифікації: назва товару мовою запиту', async () => {
    expect(await names(EN, null)).toBe('Cable');
  });

  it('знімок order_items.name і квота чекауту — назва мовою запиту', async () => {
    const input = {
      ...orderInput(db.pickup, db.point, []),
      items: [line(product, 1, red)],
    };

    const quoted = await quoteCheckoutFor(input, null, EN);
    expect(quoted.ok && quoted.quote.items[0]!.name).toBe('Cable - Red');

    const placed = await placeOrderFor(input, null, EN);
    if (!placed.ok) throw new Error(`відхилено: ${placed.reason}`);
    const rows = (await db.run(
      `select name from public.order_items where order_id = '${placed.order.id}'`,
    )) as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(['Cable - Red']);
    // Фонова доставка листа замовлення тримає зʼєднання: чекаємо її кінця, інакше
    // видалення БД тесту обриває його посеред розмови (unhandled 57P01).
    await poll('фонова доставка листів завершилась', async () => {
      const [{ n }] = (await db.run(
        `select count(*)::int as n from public.mail_outbox where attempts = 0`,
      )) as { n: number }[];
      return n === 0 ? true : undefined;
    });
  });
});
