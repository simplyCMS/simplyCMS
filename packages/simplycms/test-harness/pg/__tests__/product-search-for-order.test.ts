// К3-Е5б Task 4: вузький пошук товару для додавання в замовлення (Е5б-4) на
// справжньому Postgres — літеральні `%`/`_`/`\`, межа 2 символи БЕЗ звернення
// до БД, лише активні, збіг за модифікацією без дублів, стеля 20, authz.
import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { searchProductsForOrderOp } from 'simplycms/admin-server/impl';
import { queryRowsLockingLanguages } from '../apply.mjs';
import { useOrderItemsEditDb } from './fixtures/order-items-edit';
import {
  insertProductGraph,
  modificationGraphSql,
  viaRows,
} from './fixtures/product-graph';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/db', async (orig) => {
  const actual = await orig<typeof import('simplycms/db')>();
  return { ...actual, withActor: vi.fn(actual.withActor) };
});
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));
import { requireGrant, resolveGrant, AuthzError } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

describe('admin: пошук товару для замовлення (К3-Е5б, Task 4)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_search');
  const search = async (query: string) =>
    (await searchProductsForOrderOp({ data: { query } })).items;
  const names = async (query: string) =>
    (await search(query)).map((i) => i.name);
  const product = async (
    name: string,
    sku: string | null,
    active = true,
    translations: Record<string, { name: string }> = {},
  ) => {
    const id = randomUUID();
    await insertProductGraph(
      viaRows((sql) => f.rows(sql)),
      {
        id,
        slug: `s4-${id}`,
        name,
        sku,
        isActive: active,
        hasModifications: false,
        translations,
      },
    );
    return id;
  };
  const modification = (productId: string, name: string, sku: string | null) =>
    f.rows(
      modificationGraphSql(productId, {
        id: randomUUID(),
        slug: `m-${randomUUID()}`,
        name,
        sku,
      }),
    );

  it('% і _ — літерали: «50%» знаходить «Знижка 50%», «5_» не знаходить «50» (Review Focus 5)', async () => {
    await product('Знижка 50%', null);
    await product('Знижка 50', null);
    await product('Кабель a_b', null);
    await product('Кабель axb', null);
    expect(await names('50%')).toEqual(['Знижка 50%']);
    expect(await names('5_')).toEqual([]);
    expect(await names('a_b')).toEqual(['Кабель a_b']);
  });

  it('sku з \\ знаходиться за «B\\1»; запит із кінцевим \\ не екранує % шаблону', async () => {
    await product('Реле', 'AB\\12');
    expect(await names('B\\1')).toEqual(['Реле']);
    expect(await search('AB\\')).toEqual([
      expect.objectContaining({ name: 'Реле', sku: 'AB\\12' }),
    ]);
    expect(await names('X\\')).toEqual([]);
  });

  it('менше 2 символів → порожньо БЕЗ звернення до БД (ні withActor, ні requireGrant)', async () => {
    await product('Зарядка', null);
    vi.mocked(withActor).mockClear();
    vi.mocked(requireGrant).mockClear();
    expect(await search('з')).toEqual([]);
    expect(await search('  ')).toEqual([]);
    expect(await search('')).toEqual([]);
    expect(withActor).not.toHaveBeenCalled();
    expect(requireGrant).not.toHaveBeenCalled();
    expect((await search('за')).length).toBeGreaterThan(0);
    expect(withActor).toHaveBeenCalledTimes(1);
  });

  it('пошук для замовлення знаходить товар за en-назвою й за артикулом', async () => {
    await queryRowsLockingLanguages(
      f.db.url,
      `insert into public.languages (id, code, name, status, is_default, sort_order)
       values (gen_random_uuid(), 'en', 'English', 'published', false, 7)`,
      [],
    );
    const id = await product('Інвертор мережевий', 'INV-777', true, {
      en: { name: 'Grid inverter' },
    });
    // Англійська назва знаходить товар, а показується назва ОСНОВНОЮ мовою (адмін-читач).
    for (const q of ['grid inv', 'GRID INVERTER', 'ор мереж', 'inv-777']) {
      expect(await search(q), q).toEqual([
        {
          productId: id,
          name: 'Інвертор мережевий',
          sku: 'INV-777',
          hasModifications: false,
        },
      ]);
    }
  });

  it('збіг за англійською назвою модифікації знаходить товар', async () => {
    await product('Коробка', null);
    const id = await product('Реле часу', null);
    await f.rows(
      modificationGraphSql(id, {
        id: randomUUID(),
        slug: `m-${randomUUID()}`,
        name: 'Червона',
        translations: { en: { name: 'Crimson' } },
      }),
    );
    expect(await names('crimson')).toEqual(['Реле часу']);
  });

  it('неактивний товар не повертається', async () => {
    await product('Прихований товар', null, false);
    await product('Видимий товар', null, true);
    expect(await names('товар')).toEqual(['Видимий товар']);
  });

  it('збіг за sku/назвою модифікації → товар один раз, hasModifications правдиве', async () => {
    const id = await product('Контролер', 'CTRL', true);
    await modification(id, 'Версія Альфа', 'ZZ-ALPHA-1');
    await modification(id, 'Версія Бета', 'ZZ-ALPHA-2');
    for (const q of ['ZZ-ALPHA', 'zz-alpha-2', 'версія']) {
      expect(await search(q)).toEqual([
        {
          productId: id,
          name: 'Контролер',
          sku: 'CTRL',
          hasModifications: true,
        },
      ]);
    }
  });

  it('не більше 20, порядок за назвою', async () => {
    for (let i = 25; i >= 1; i--)
      await product(`Масовий ${String(i).padStart(2, '0')}`, null);
    const got = await names('Масовий');
    expect(got).toHaveLength(20);
    expect(got).toEqual([...got].sort());
    expect(got[0]).toBe('Масовий 01');
  });

  it('не-адмін → AuthzError', async () => {
    vi.mocked(requireGrant).mockImplementation(async (operation) => {
      const subject = { userId: f.ids.user, roles: ['user'] as const };
      const scope = resolveGrant(subject, operation);
      if (!scope) throw new AuthzError(operation);
      return { subject, scope };
    });
    try {
      await expect(search('панель')).rejects.toThrow(AuthzError);
    } finally {
      vi.mocked(requireGrant).mockReset();
      vi.mocked(requireGrant).mockImplementation(async () => ({
        subject: { userId: null, roles: ['admin'] },
        scope: 'any',
      }));
    }
  });
});
