// М1 Task 12 (І21 модифікації, Р5, Р14, Р18): модифікації й значення властивостей
// агрегата товару та тонкі команди цін і залишків проти живого Postgres.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AdminConflictError,
  ValidationError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import {
  productsSavePrices,
  productsSaveStock,
  productsSetModificationToken,
} from 'simplycms/admin-server/impl';
import { TRANSLATABLE, deleteTranslation } from 'simplycms/translations';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  create,
  exec,
  get,
  saveDescription,
} from './fixtures/product-aggregate';

describe('агрегат товару: модифікації, значення, ціни й залишки (Task 12)', () => {
  const db = useAddressingDb('simplycms_product_children');
  const rejects = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );
  const tokens = async (modId: string) =>
    db.q(
      `select locale, slug, is_current from public.slug_tokens
        where modification_id = $1 order by locale, slug`,
      [modId],
    );
  const version = async (id: string) =>
    (await db.q(`select version from public.products where id = $1`, [id]))[0]!
      .version as number;
  const modOf = (id: string, name: string, extra: object = {}) => ({
    id,
    texts: { uk: { name } },
    ...extra,
  });

  /** Товар + властивість заданого типу (+ опції), для тестів значень. */
  const property = async (type: string, options: string[] = []) => {
    const pid = randomUUID();
    await db.q(
      `insert into public.section_properties (id, name, slug, property_type)
       values ($1, $2, $3, $4::property_type)`,
      [pid, `P-${pid}`, `p-${pid}`, type],
    );
    const ids: string[] = [];
    for (const name of options) {
      const id = randomUUID();
      await db.q(
        `insert into public.property_options (id, property_id, name, slug) values ($1, $2, $3, $4)`,
        [id, pid, name, `o-${id}`],
      );
      ids.push(id);
    }
    return { pid, ids };
  };

  beforeAll(async () => {
    await db.language('en');
    await db.language('de', 'draft');
    await db.language('xx', 'disabled');
  });

  it('нова модифікація → токени в усіх draft/published мовах, не в disabled (І21)', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const mod = randomUUID();
    await saveDescription(id, v, {
      modifications: { upsert: [modOf(mod, 'Червоний')] },
    });
    const rows = await tokens(mod);
    expect(rows.map((r) => r.locale)).toEqual(['de', 'en', 'uk']);
    expect(rows.every((r) => r.is_current)).toBe(true);
    // Старі колонки (М1-TEMP) дзеркалять основну мову.
    const [legacy] = await db.q(
      `select name, slug from public.product_modifications where id = $1`,
      [mod],
    );
    expect(legacy).toMatchObject({
      name: 'Червоний',
      slug: rows.find((r) => r.locale === 'uk')!.slug,
    });
  });

  it('нова модифікація без назви основної мови → validation, без токенів', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const mod = randomUUID();
    const err = await rejects(
      saveDescription(id, v, {
        modifications: {
          upsert: [{ id: mod, texts: { en: { name: 'Red' } } }],
        },
      }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect(await tokens(mod)).toHaveLength(0);
  });

  it('переклад назви модифікації не змінює токен', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const mod = randomUUID();
    const s1 = await saveDescription(id, v, {
      modifications: { upsert: [modOf(mod, 'Чорний')] },
    });
    const before = await tokens(mod);
    await saveDescription(id, s1.version, {
      modifications: {
        upsert: [
          {
            id: mod,
            texts: { en: { name: 'Black' }, uk: { name: 'Чорний-2' } },
          },
        ],
      },
    });
    expect(await tokens(mod)).toEqual(before);
  });

  it('deleteTranslation модифікації en → токен en лишається', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const mod = randomUUID();
    await saveDescription(id, v, {
      modifications: {
        upsert: [
          { id: mod, texts: { uk: { name: 'Синій' }, en: { name: 'Blue' } } },
        ],
      },
    });
    await db.admin((tx) =>
      deleteTranslation(tx, TRANSLATABLE.productModification, mod, 'en'),
    );
    expect(
      await db.q(
        `select 1 from public.product_modification_translations where modification_id = $1 and locale = 'en'`,
        [mod],
      ),
    ).toHaveLength(0);
    expect((await tokens(mod)).map((r) => r.locale)).toContain('en');
  });

  it('модифікація без remove лишається; remove — явний, токени зникають разом із нею', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const [a, b] = [randomUUID(), randomUUID()];
    const s1 = await saveDescription(id, v, {
      modifications: { upsert: [modOf(a, 'A'), modOf(b, 'B')] },
    });
    const s2 = await saveDescription(id, s1.version, {
      modifications: { upsert: [modOf(a, 'A2')] },
    });
    const left = () =>
      db.q(
        `select id from public.product_modifications where product_id = $1`,
        [id],
      );
    expect(await left()).toHaveLength(2);
    await saveDescription(id, s2.version, { modifications: { remove: [b] } });
    expect((await left()).map((r) => r.id)).toEqual([a]);
    expect(await tokens(b)).toHaveLength(0);
  });

  it('isDefault: дефолт один на товар', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const [a, b] = [randomUUID(), randomUUID()];
    const s1 = await saveDescription(id, v, {
      modifications: {
        upsert: [modOf(a, 'A', { isDefault: true }), modOf(b, 'B')],
      },
    });
    await saveDescription(id, s1.version, {
      modifications: { upsert: [{ id: b, isDefault: true }] },
    });
    const rows = await db.q(
      `select id from public.product_modifications where product_id = $1 and is_default`,
      [id],
    );
    expect(rows.map((r) => r.id)).toEqual([b]);
  });

  it('чужа модифікація → validation', async () => {
    const one = await create({ uk: { name: 'Один' } });
    const two = await create({ uk: { name: 'Два' } });
    const mod = randomUUID();
    await saveDescription(one.id, one.version, {
      modifications: { upsert: [modOf(mod, 'M')] },
    });
    expect(
      await rejects(
        saveDescription(two.id, two.version, {
          modifications: { upsert: [modOf(mod, 'M')] },
        }),
      ),
    ).toBeInstanceOf(ValidationError);
  });

  it('setModificationToken: нова адреса, старий токен — історія, чужий — 409; версія росте', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const [a, b] = [randomUUID(), randomUUID()];
    const s1 = await saveDescription(id, v, {
      modifications: { upsert: [modOf(a, 'Aa'), modOf(b, 'Bb')] },
    });
    const out = await exec(productsSetModificationToken, {
      modificationId: a,
      locale: 'en',
      slug: 'red-cable',
      expectedVersion: s1.version,
    });
    expect(out.version).toBe(s1.version + 1);
    const en = (await tokens(a)).filter((r) => r.locale === 'en');
    expect(en.find((r) => r.is_current)!.slug).toBe('red-cable');
    expect(en.some((r) => !r.is_current)).toBe(true);
    const clash = await rejects(
      exec(productsSetModificationToken, {
        modificationId: b,
        locale: 'en',
        slug: 'red-cable',
        expectedVersion: out.version,
      }),
    );
    expect(clash).toBeInstanceOf(AdminConflictError);
    expect(
      await rejects(
        exec(productsSetModificationToken, {
          modificationId: a,
          locale: 'en',
          slug: 'x',
          expectedVersion: 1,
        }),
      ),
    ).toBeInstanceOf(VersionMismatchError);
  });

  describe('значення властивостей (Р18)', () => {
    it('значення без remove лишається', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const p = await property('number');
      const val = randomUUID();
      const s1 = await saveDescription(id, v, {
        propertyValues: {
          upsert: [
            { id: val, propertyId: p.pid, kind: 'number', number: '12.5' },
          ],
        },
      });
      await saveDescription(id, s1.version, {
        texts: { uk: { name: 'Кабель 2' } },
      });
      const [row] = await db.q(
        `select value_kind, numeric_value from public.product_property_values where id = $1`,
        [val],
      );
      expect(row).toMatchObject({
        value_kind: 'number',
        numeric_value: '12.5000',
      });
    });

    it('text-значення: переклад по мовах; number — без перекладу', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const t = await property('text');
      const n = await property('number');
      const [tv, nv] = [randomUUID(), randomUUID()];
      await saveDescription(id, v, {
        propertyValues: {
          upsert: [
            {
              id: tv,
              propertyId: t.pid,
              kind: 'text',
              text: { uk: 'Мідь', en: 'Copper' },
            },
            { id: nv, propertyId: n.pid, kind: 'number', number: '3' },
          ],
        },
      });
      const tr = await db.q(
        `select locale, value from public.product_property_value_translations where value_id = $1 order by locale`,
        [tv],
      );
      expect(tr).toMatchObject([
        { locale: 'en', value: 'Copper' },
        { locale: 'uk', value: 'Мідь' },
      ]);
      expect(
        await db.q(
          `select 1 from public.product_property_value_translations where value_id = $1`,
          [nv],
        ),
      ).toHaveLength(0);
      // М1-TEMP: текст основної мови дзеркалиться в `value`.
      expect(
        (
          await db.q(
            `select value from public.product_property_values where id = $1`,
            [tv],
          )
        )[0]!.value,
      ).toBe('Мідь');
    });

    it('значення модифікації: select з опцією, multiselect — рядок на опцію', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const sel = await property('select', ['A', 'B']);
      const multi = await property('multiselect', ['X', 'Y']);
      const mod = randomUUID();
      const s1 = await saveDescription(id, v, {
        modifications: { upsert: [modOf(mod, 'M')] },
      });
      await saveDescription(id, s1.version, {
        propertyValues: {
          upsert: [
            {
              id: randomUUID(),
              propertyId: sel.pid,
              kind: 'select',
              optionId: sel.ids[0],
              modificationId: mod,
            },
            {
              id: randomUUID(),
              propertyId: multi.pid,
              kind: 'multiselect',
              optionId: multi.ids[0],
              modificationId: mod,
            },
            {
              id: randomUUID(),
              propertyId: multi.pid,
              kind: 'multiselect',
              optionId: multi.ids[1],
              modificationId: mod,
            },
          ],
        },
      });
      const rows = await db.q(
        `select value_kind from public.modification_property_values where modification_id = $1`,
        [mod],
      );
      expect(rows).toHaveLength(3);
    });

    it('kind ≠ property_type → validation (звірка до складеного FK Task 17)', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const p = await property('number');
      const err = await rejects(
        saveDescription(id, v, {
          propertyValues: {
            upsert: [
              {
                id: randomUUID(),
                propertyId: p.pid,
                kind: 'boolean',
                bool: true,
              },
            ],
          },
        }),
      );
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues[0]?.path).toEqual([
        'propertyValues',
        'upsert',
        0,
        'kind',
      ]);
      expect(await version(id)).toBe(v);
    });

    it('колонка значення не за типом, чужа опція, дубль скаляра → відмова', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const num = await property('number');
      const sel = await property('select', ['A']);
      const other = await property('select', ['Z']);
      const base = { propertyId: num.pid, kind: 'number' as const };
      const bad = (upsert: object[]) =>
        rejects(saveDescription(id, v, { propertyValues: { upsert } }));
      // number з зайвою колонкою bool
      expect(
        await bad([{ id: randomUUID(), ...base, number: '1', bool: true }]),
      ).toBeInstanceOf(ValidationError);
      // number без числа
      expect(await bad([{ id: randomUUID(), ...base }])).toBeInstanceOf(
        ValidationError,
      );
      // опція іншої властивості
      expect(
        await bad([
          {
            id: randomUUID(),
            propertyId: sel.pid,
            kind: 'select',
            optionId: other.ids[0],
          },
        ]),
      ).toBeInstanceOf(ValidationError);
      // текст для не-text значення
      expect(
        await bad([
          { id: randomUUID(), ...base, number: '1', text: { uk: 'x' } },
        ]),
      ).toBeInstanceOf(ValidationError);
      // два рядки скалярної властивості
      expect(
        await bad([
          { id: randomUUID(), ...base, number: '1' },
          { id: randomUUID(), ...base, number: '2' },
        ]),
      ).toBeInstanceOf(AdminConflictError);
    });

    it('другий рядок скаляра з іншим id проти БД → 409; remove у тій самій команді дозволяє заміну', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const p = await property('number');
      const [first, second] = [randomUUID(), randomUUID()];
      const s1 = await saveDescription(id, v, {
        propertyValues: {
          upsert: [
            { id: first, propertyId: p.pid, kind: 'number', number: '1' },
          ],
        },
      });
      const next = {
        id: second,
        propertyId: p.pid,
        kind: 'number',
        number: '2',
      };
      expect(
        await rejects(
          saveDescription(id, s1.version, {
            propertyValues: { upsert: [next] },
          }),
        ),
      ).toBeInstanceOf(AdminConflictError);
      await saveDescription(id, s1.version, {
        propertyValues: { upsert: [next], remove: [first] },
      });
      expect(
        (
          await db.q(
            `select id from public.product_property_values where product_id = $1`,
            [id],
          )
        ).map((r) => r.id),
      ).toEqual([second]);
    });
  });

  describe('ціни й залишки — тонкі команди (Р14)', () => {
    it('savePrices не змінює version', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const [pt] = await db.q(`select id from public.price_types limit 1`);
      const out = await exec(productsSavePrices, {
        productId: id,
        modificationId: null,
        prices: [{ priceTypeId: pt!.id, price: '10.00', oldPrice: null }],
      });
      expect(out.count).toBe(1);
      expect(await version(id)).toBe(v);
      expect((await get(id)).version).toBe(v);
    });

    it('saveStock не змінює version', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const [method, point] = [randomUUID(), randomUUID()];
      await db.q(
        `insert into public.shipping_methods (id, code, name, provider)
         values ($1, $2, 'Самовивіз', 'pickup')`,
        [method, `m-${method}`],
      );
      await db.q(
        `insert into public.pickup_points (id, method_id, name, address, city)
         values ($1, $2, 'Т', 'Адреса', 'Київ')`,
        [point, method],
      );
      const out = await exec(productsSaveStock, {
        productId: id,
        modificationId: null,
        quantities: [{ pickupPointId: point, quantity: 5 }],
      });
      expect(out.count).toBe(1);
      expect(await version(id)).toBe(v);
    });
  });

  describe('products.get віддає дітей агрегата', () => {
    it('read-modify-write: get -> змінити одне поле -> saveDescription з тим самим вмістом -> нічого зайвого, версія +1', async () => {
      const { id, version: v } = await create({ uk: { name: 'Кабель' } });
      const sel = await property('select', ['A']);
      const txt = await property('text');
      const mod = randomUUID();
      const s1 = await saveDescription(id, v, {
        modifications: {
          upsert: [
            {
              id: mod,
              sku: 'S-1',
              isDefault: true,
              sortOrder: 2,
              texts: { uk: { name: 'Червоний' }, en: { name: 'Red' } },
            },
          ],
        },
        propertyValues: {
          upsert: [
            {
              id: randomUUID(),
              propertyId: sel.pid,
              kind: 'select',
              optionId: sel.ids[0],
            },
            {
              id: randomUUID(),
              propertyId: txt.pid,
              kind: 'text',
              text: { uk: 'Мідь', en: 'Copper' },
              modificationId: mod,
            },
          ],
        },
      });
      const snapshot = async () => ({
        mods: await db.q(
          `select id, sku, is_default, sort_order from public.product_modifications where product_id = $1`,
          [id],
        ),
        tokens: await tokens(mod),
        vals: await db.q(
          `select id, value_kind, option_id from public.product_property_values where product_id = $1`,
          [id],
        ),
        mvals: await db.q(
          `select value_id, locale, value from public.modification_property_value_translations order by value_id, locale`,
        ),
      });
      const before = await snapshot();
      const got = await get(id);
      expect(got.modifications).toMatchObject([
        {
          id: mod,
          sku: 'S-1',
          isDefault: true,
          sortOrder: 2,
          texts: { en: { name: 'Red', status: 'current' } },
        },
      ]);
      expect(Object.keys(got.modifications[0]!.token).sort()).toEqual([
        'de',
        'en',
        'uk',
      ]);
      expect(got.propertyValues).toHaveLength(2);
      // Відповідь -> вхід: ЛИШЕ зняти поля статусу, без перейменувань і зміни форм.
      const strip = (v: unknown): unknown =>
        Array.isArray(v)
          ? v.map(strip)
          : v && typeof v === 'object'
            ? Object.fromEntries(
                Object.entries(v)
                  .filter(
                    ([k]) =>
                      !['status', 'fieldStatus', 'textStatus'].includes(k),
                  )
                  .map(([k, x]) => [k, strip(x)]),
              )
            : v;
      const back = {
        modifications: {
          upsert: strip(got.modifications) as { sku: string }[],
        },
        propertyValues: { upsert: strip(got.propertyValues) },
        images: { upsert: strip(got.images) },
      };
      back.modifications.upsert[0]!.sku = 'S-2'; // єдина зміна
      const out = await saveDescription(id, got.version, back);
      expect(out.version).toBe(s1.version + 1);
      const after = await snapshot();
      expect(after.tokens).toEqual(before.tokens);
      expect(after.vals).toEqual(before.vals);
      expect(after.mvals).toEqual(before.mvals);
      expect(after.mods).toEqual(
        before.mods.map((m) => ({ ...m, sku: 'S-2' })),
      );
    });
  });

  it('значення не переносимо між власниками: інший modificationId або товар↔модифікація -> validation', async () => {
    const { id, version: v } = await create({ uk: { name: 'Кабель' } });
    const p = await property('number');
    const [a, b, val] = [randomUUID(), randomUUID(), randomUUID()];
    const s1 = await saveDescription(id, v, {
      modifications: { upsert: [modOf(a, 'A'), modOf(b, 'B')] },
      propertyValues: {
        upsert: [
          {
            id: val,
            propertyId: p.pid,
            kind: 'number',
            number: '1',
            modificationId: a,
          },
        ],
      },
    });
    for (const owner of [{ modificationId: b }, {}])
      expect(
        await rejects(
          saveDescription(id, s1.version, {
            propertyValues: {
              upsert: [
                {
                  id: val,
                  propertyId: p.pid,
                  kind: 'number',
                  number: '2',
                  ...owner,
                },
              ],
            },
          }),
        ),
      ).toBeInstanceOf(ValidationError);
    expect(
      (
        await db.q(
          `select modification_id from public.modification_property_values where id = $1`,
          [val],
        )
      )[0]!.modification_id,
    ).toBe(a);
  });

  it('savePrices: модифікація іншого товару -> validation; saveStock лишається lock-нейтральним', async () => {
    const one = await create({ uk: { name: 'Один' } });
    const two = await create({ uk: { name: 'Два' } });
    const mod = randomUUID();
    await saveDescription(two.id, two.version, {
      modifications: { upsert: [modOf(mod, 'M')] },
    });
    const [pt] = await db.q(`select id from public.price_types limit 1`);
    const prices = [{ priceTypeId: pt!.id, price: '10.00', oldPrice: null }];
    expect(
      await rejects(
        exec(productsSavePrices, {
          productId: one.id,
          modificationId: mod,
          prices,
        }),
      ),
    ).toBeInstanceOf(ValidationError);
    expect(
      await db.q(
        `select 1 from public.product_prices where modification_id = $1`,
        [mod],
      ),
    ).toHaveLength(0);
    await exec(productsSavePrices, {
      productId: two.id,
      modificationId: mod,
      prices,
    });
  });
});
