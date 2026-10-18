// М1 Task 16 (фікс-раунд 1, A1–A3): колекції адмінки товару й модифікації читають НАЗВУ з
// перекладу основної мови (read-model фабрики ресурсу), а не з дзеркальних колонок. Сортування
// й пошук за `name` ідуть через JOIN; товар без перекладу основної мови (дефект даних) у
// вибірку не потрапляє.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  productModificationsOps,
  productsOps,
} from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, saveDescription } from './fixtures/product-aggregate';

describe('read-model колекцій адмінки: назва з перекладу основної мови (Task 16)', () => {
  const db = useAddressingDb('simplycms_admin_read_model');
  const section = randomUUID();
  const list = (subset: object) =>
    productsOps.list({ data: { subset } }) as Promise<
      { id: string; name: string }[]
    >;
  const inSection = { field: ['sectionId'], operator: 'eq', value: section };

  beforeAll(async () => {
    await db.q(
      `insert into public.sections (id, slug, name) values ($1, 'rm-sec', 'Розділ')`,
      [section],
    );
  });

  it('назва береться з product_translations, а не з дзеркальної колонки products.name', async () => {
    const { id } = await create(
      { uk: { name: 'Перекладена назва' } },
      { sectionId: section },
    );
    // Псуємо дзеркало напряму: read-model мусить його ігнорувати.
    await db.q(`update public.products set name = 'ДЗЕРКАЛО' where id = $1`, [
      id,
    ]);

    const rows = await list({
      filters: [{ ...inSection }, { field: ['id'], operator: 'eq', value: id }],
    });
    expect(rows.map((r) => r.name)).toEqual(['Перекладена назва']);
    // Дзеркальні тексти з читальної форми зникли — Task 17 зносить колонки без сюрпризів.
    expect(Object.keys(rows[0]!)).not.toEqual(
      expect.arrayContaining(['slug', 'description']),
    );
  });

  it('сортування за name після перейменування в основній мові через saveDescription — новий порядок', async () => {
    const a = await create(
      { uk: { name: 'Сорт Альфа' } },
      { sectionId: section },
    );
    const b = await create(
      { uk: { name: 'Сорт Бета' } },
      { sectionId: section },
    );
    // Дзеркала в зворотному порядку: сортування за дзеркалом дало б інший результат.
    await db.q(`update public.products set name = 'Яя' where id = $1`, [a.id]);
    await db.q(`update public.products set name = 'Аа' where id = $1`, [b.id]);
    const sorted = async () =>
      (
        await list({
          filters: [inSection],
          sorts: [{ field: ['name'], direction: 'asc' }],
        })
      )
        .map((r) => r.name)
        .filter((n) => n.startsWith('Сорт'));
    expect(await sorted()).toEqual(['Сорт Альфа', 'Сорт Бета']);

    await saveDescription(a.id, a.version, {
      texts: { uk: { name: 'Сорт Омега' } },
    });
    expect(await sorted()).toEqual(['Сорт Бета', 'Сорт Омега']);
  });

  it('фільтр eq за name працює через JOIN на переклад', async () => {
    await create({ uk: { name: 'Точна назва' } }, { sectionId: section });
    const rows = await list({
      filters: [{ field: ['name'], operator: 'eq', value: 'Точна назва' }],
    });
    expect(rows.map((r) => r.name)).toEqual(['Точна назва']);
  });

  it('товар без перекладу основної мови (дефект даних) не потрапляє у вибірку, а не з порожньою назвою', async () => {
    const [orphan] = await productsOps.insert({
      data: [
        {
          id: randomUUID(),
          slug: 'rm-orphan',
          name: 'Сирота',
          sectionId: section,
        },
      ],
    });
    const ids = (await list({ filters: [inSection] })).map((r) => r.id);
    expect(ids).not.toContain(orphan!.id);
  });

  it('модифікація: назва з перекладу основної мови, slug немає, сортування за name', async () => {
    const { id, version } = await create(
      { uk: { name: 'Товар модифікацій' } },
      { sectionId: section },
    );
    const m1 = randomUUID();
    const m2 = randomUUID();
    await saveDescription(id, version, {
      modifications: {
        upsert: [
          { id: m1, texts: { uk: { name: 'Яблуко' } } },
          { id: m2, texts: { uk: { name: 'Банан' } } },
        ],
      },
    });
    await db.q(
      `update public.product_modifications set name = 'ДЗЕРКАЛО' where id = $1`,
      [m1],
    );

    const rows = (await productModificationsOps.list({
      data: {
        subset: {
          filters: [{ field: ['productId'], operator: 'eq', value: id }],
          sorts: [{ field: ['name'], direction: 'asc' }],
        },
      },
    })) as unknown as { id: string; name: string }[];
    expect(rows.map((r) => r.name)).toEqual(['Банан', 'Яблуко']);
    expect('slug' in rows[0]!).toBe(false);
  });
});
