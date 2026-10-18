// М1 Task 16 (фікс-раунд 1, A1–A3): колекції адмінки товару й модифікації читають НАЗВУ з
// перекладу основної мови (read-model фабрики ресурсу). Сортування й пошук за `name` ідуть
// через JOIN. Task 17: текстових колонок у базі немає; INNER JOIN спирається на І4 (рядок
// основної мови обов'язковий — тригер), мініатюра — обчислене поле `mainImage` (перше фото
// галереї агрегата в порядку вітрини).
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
import { insertProductGraphAt } from './fixtures/product-graph';

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

  it('назва береться з product_translations основної мови', async () => {
    const { id } = await create(
      { uk: { name: 'Перекладена назва' } },
      { sectionId: section },
    );

    const rows = await list({
      filters: [{ ...inSection }, { field: ['id'], operator: 'eq', value: id }],
    });
    expect(rows.map((r) => r.name)).toEqual(['Перекладена назва']);
    expect(Object.keys(rows[0]!)).not.toEqual(
      expect.arrayContaining(['slug', 'description']),
    );
  });

  it('сортування за name після перейменування в основній мові через saveDescription — новий порядок', async () => {
    const a = await create(
      { uk: { name: 'Сорт Альфа' } },
      { sectionId: section },
    );
    await create({ uk: { name: 'Сорт Бета' } }, { sectionId: section });
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

  // Передумова INNER JOIN: товару без рядка основної мови не буває — тригер джерела (І4)
  // відхиляє і видалення цього рядка, тож рядок у вибірці не «губиться» мовчки.
  it('видалення перекладу основної мови — відмова (І4), товар лишається у вибірці', async () => {
    const { id } = await create(
      { uk: { name: 'Без сироти' } },
      { sectionId: section },
    );
    await expect(
      db.tx(
        `delete from public.product_translations where product_id = '${id}' and locale = 'uk'`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const ids = (await list({ filters: [inSection] })).map((r) => r.id);
    expect(ids).toContain(id);
  });

  it('mainImage: перше фото галереї товару (sort_order), без фото — null', async () => {
    const withPhotos = randomUUID();
    await insertProductGraphAt(db.url(), {
      id: withPhotos,
      slug: 'rm-photos',
      name: 'Фото',
      sectionId: section,
      images: ['ab/first.png', 'ab/second.png'],
      modifications: [
        { id: randomUUID(), slug: 'rm-m', name: 'М', images: ['ab/mod.png'] },
      ],
    });
    const bare = (
      await create({ uk: { name: 'Без фото' } }, { sectionId: section })
    ).id;
    const rows = (await list({ filters: [inSection] })) as unknown as {
      id: string;
      mainImage: string | null;
    }[];
    const byId = new Map(rows.map((r) => [r.id, r.mainImage]));
    expect(byId.get(withPhotos)).toBe('ab/first.png');
    expect(byId.get(bare)).toBeNull();
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
