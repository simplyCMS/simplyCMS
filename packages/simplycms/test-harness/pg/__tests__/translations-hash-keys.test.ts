// М1 Task 11, І10: ключі `source_hashes` у БД — підмножина перекладних полів
// типу (`spec.fields`), для КОЖНОЇ таблиці перекладів реєстру, а не лише товару.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { planTranslationWrite } from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  sourceFieldHash,
  type TranslatableEntity,
} from 'simplycms/translations';
import { useAddressingDb } from './fixtures/addressing-db';
import { insertProductGraphAt } from './fixtures/product-graph';
import {
  create,
  saveDescription,
  saveTranslation,
} from './fixtures/product-aggregate';

describe('ключі source_hashes ⊆ spec.fields (І10)', () => {
  const db = useAddressingDb('simplycms_translations_hash_keys');
  const keys = async (table: string) =>
    (
      await db.q(
        `select distinct jsonb_object_keys(source_hashes) k from public.${table}`,
      )
    ).map((r) => String(r.k));

  const ids = {
    product: randomUUID(),
    mod: randomUUID(),
    pv: randomUUID(),
    mv: randomUUID(),
    prop: randomUUID(),
  };

  beforeAll(async () => {
    await db.language('en');
    await db.q(
      `insert into public.section_properties (id, name, slug, property_type)
       values ($1, 'p', 'hk-prop', 'text')`,
      [ids.prop],
    );
    await insertProductGraphAt(db.url(), {
      id: ids.product,
      slug: 'hk-product',
      name: 'Товар',
      images: ['k1.png'],
      values: [
        {
          id: ids.pv,
          propertyId: ids.prop,
          kind: 'text',
          text: { uk: 'значення' },
        },
      ],
      modifications: [
        {
          id: ids.mod,
          slug: 'hk-mod',
          name: 'Мод',
          values: [
            {
              id: ids.mv,
              propertyId: ids.prop,
              kind: 'text',
              text: { uk: 'значення' },
            },
          ],
        },
      ],
    });
  });

  it('операції агрегата товару пишуть лише поля специфікації', async () => {
    const { id, version } = await create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable', description: '<p>Desc</p>' },
    });
    const v2 = (
      await saveDescription(id, version, {
        texts: { uk: { name: 'Кабель 2' }, en: { name: 'Cable 2' } },
      })
    ).version;
    await saveTranslation(
      id,
      v2,
      'en',
      { shortDescription: 'Short' },
      { name: sourceFieldHash('Кабель 2') },
    );
    const found = await keys('product_translations');
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.every((k) => TRANSLATABLE.product.fields.includes(k as never)),
    ).toBe(true);
  });

  /** Рядок перекладу будь-якої таблиці реєстру через спільний хелпер запису. */
  const writeVia = async (
    spec: TranslatableEntity,
    entityId: string,
    field: string,
    extra = {},
  ) => {
    const plan = planTranslationWrite({
      spec,
      current: {
        source: { values: { [field]: 'джерело' } },
        byLocale: new Map(),
      },
      primary: 'uk',
      patch: new Map([['en', { [field]: 'source-en' }]]),
      hash: sourceFieldHash,
    });
    await db.admin((tx) =>
      applyTranslationPlan(tx, spec, entityId, plan, extra),
    );
  };

  it('кожна таблиця реєстру: ключі хешів ⊆ spec.fields, а запис справді стампує хеш', async () => {
    const [img] = await db.q(
      `select id from public.product_images where product_id = $1`,
      [ids.product],
    );
    await writeVia(TRANSLATABLE.productModification, ids.mod, 'name', {
      product_id: ids.product,
    });
    await writeVia(TRANSLATABLE.productImage, String(img!.id), 'alt');
    await writeVia(TRANSLATABLE.productPropertyValue, ids.pv, 'value');
    await writeVia(TRANSLATABLE.modificationPropertyValue, ids.mv, 'value');
    for (const spec of Object.values(TRANSLATABLE)) {
      const found = await keys(spec.table);
      expect(
        found.every((k) => (spec.fields as readonly string[]).includes(k)),
        spec.table,
      ).toBe(true);
    }
    for (const t of [
      'product_modification_translations',
      'product_image_translations',
      'product_property_value_translations',
      'modification_property_value_translations',
    ])
      expect((await keys(t)).length, t).toBeGreaterThan(0);
  });
});
