// М1 Task 17 (І5–І8, Р18): форму значення властивості тримає БД, а не команда.
//  • І6 — складений FK `(property_id, value_kind) → section_properties(id, property_type)`
//    і CHECK «рівно одна колонка за `value_kind`»;
//  • І7 — складений FK `(property_id, option_id) → property_options(property_id, id)`;
//  • І8 — частковий UNIQUE скаляра `(власник, property_id) WHERE value_kind <> 'multiselect'`;
//  • І5 — текст обовʼязковий лише для `value_kind = 'text'` (умова тригера джерела).
// Кожен кейс — для товару й модифікації: обидві таблиці мають ті самі обмеження.
// Рядки пише билдер графа (`valueSql`) сирою транзакцією `app_admin`: відкладені
// тригери стріляють на її COMMIT.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { useAddressingDb } from './fixtures/addressing-db';
import { valueSql, type ValueSpec } from './fixtures/product-graph';

const CHECK = { code: '23514' };
const FK = { code: '23503' };
const UNIQUE = { code: '23505' };

describe.each(['product', 'modification'] as const)(
  'форма значення властивості (%s): І5–І8',
  (kind) => {
    const db = useAddressingDb(`simplycms_value_shape_${kind}`);
    const props = { number: '', select: '', multi: '', other: '', text: '' };
    const opts = { select: [] as string[], multi: [] as string[], other: '' };
    let owner = '';

    const property = async (type: string, options = 0) => {
      const id = randomUUID();
      await db.q(
        `insert into public.section_properties (id, name, slug, property_type)
         values ($1, $3, $4, $2::property_type)`,
        [id, type, `p-${id}`, `p-${id}`],
      );
      const ids: string[] = [];
      for (let i = 0; i < options; i += 1) {
        const o = randomUUID();
        await db.q(
          `insert into public.property_options (id, property_id, name, slug)
           values ($1, $2, $3, $4)`,
          [o, id, `o-${o}`, `o-${o}`],
        );
        ids.push(o);
      }
      return { id, ids };
    };
    /** Значення власника як сира транзакція `app_admin` (COMMIT — у кінці). */
    const write = (...values: Omit<ValueSpec, 'id'>[]) =>
      db.tx(
        ...values.flatMap((v) =>
          valueSql({ kind, id: owner }, { id: randomUUID(), ...v }),
        ),
      );

    beforeAll(async () => {
      await db.language('en');
      const product = await db.product();
      owner =
        kind === 'product' ? product : await db.modification(product, 'shape');
      const number = await property('number');
      const select = await property('select', 2);
      const multi = await property('multiselect', 2);
      const other = await property('select', 1);
      const text = await property('text');
      Object.assign(props, {
        number: number.id,
        select: select.id,
        multi: multi.id,
        other: other.id,
        text: text.id,
      });
      Object.assign(opts, {
        select: select.ids,
        multi: multi.ids,
        other: other.ids[0],
      });
    });

    it('І6: number з option_id → check_violation', async () => {
      await expect(
        write({
          propertyId: props.number,
          kind: 'number',
          number: 1,
          optionId: opts.select[0],
        }),
      ).rejects.toMatchObject(CHECK);
    });

    it("І6: value_kind='number' для select-властивості → foreign_key_violation", async () => {
      await expect(
        write({ propertyId: props.select, kind: 'number', number: 1 }),
      ).rejects.toMatchObject(FK);
    });

    it('І7: опція чужої властивості → foreign_key_violation', async () => {
      // Власна властивість кейсу: рядки інших кейсів не впливають на результат.
      const own = await property('select', 1);
      await expect(
        write({
          propertyId: own.id,
          kind: 'select',
          optionId: opts.other,
        }),
      ).rejects.toMatchObject(FK);
    });

    it('І8: два рядки select → unique_violation; два multiselect з різними опціями → коміт', async () => {
      await expect(
        write(
          {
            propertyId: props.select,
            kind: 'select',
            optionId: opts.select[0],
          },
          {
            propertyId: props.select,
            kind: 'select',
            optionId: opts.select[1],
          },
        ),
      ).rejects.toMatchObject(UNIQUE);
      await write(
        {
          propertyId: props.multi,
          kind: 'multiselect',
          optionId: opts.multi[0],
        },
        {
          propertyId: props.multi,
          kind: 'multiselect',
          optionId: opts.multi[1],
        },
      );
    });

    it('І5: number без перекладу → коміт; text без рядка основної мови → відмова', async () => {
      await write({ propertyId: props.number, kind: 'number', number: 450 });
      await expect(
        write({
          propertyId: props.text,
          kind: 'text',
          text: { en: 'Only en' },
        }),
      ).rejects.toMatchObject(CHECK);
      // Позитивний контроль: текст основною мовою — коміт.
      await write({
        propertyId: props.text,
        kind: 'text',
        text: { uk: 'Текст' },
      });
    });

    it('зміна property_type властивості з наявними значеннями → foreign_key_violation (ON UPDATE RESTRICT)', async () => {
      const own = await property('number');
      await write({ propertyId: own.id, kind: 'number', number: 7 });
      await expect(
        db.q(
          `update public.section_properties set property_type = 'text' where id = $1`,
          [own.id],
        ),
      ).rejects.toMatchObject(FK);
    });
  },
);
