// К3-Е6д-3, Е6д-22: `findMediaReferences` проти живої БД. Тест-парність:
// кожен запис `MEDIA_COLUMNS` мусить мати сіятель у цьому файлі й знаходитись;
// нова медіа-колонка реєстру без сіятеля чи без гілки у функції червонить тест.
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { MEDIA_COLUMNS } from 'simplycms/domain/media';
import { findMediaReferences } from 'simplycms/storage';
import { useReviewsDb } from './fixtures/reviews';

describe('findMediaReferences (Е6д-22)', () => {
  const d = useReviewsDb('simplycms_e6d_media_refs');
  const { f } = d;
  const find = (key: string) =>
    withActor({ role: 'app_admin' }, (db) => findMediaReferences(db, key));
  const fresh = () => `ab/${crypto.randomUUID()}.png`;
  const jsonKey = (ref: string) => JSON.stringify([`ab/other.png`, ref]);

  /** Сіятель на запис реєстру: кладе `key` у колонку нового рядка, повертає його id. */
  const SEEDERS: Record<string, (key: string) => Promise<string>> = {
    'products.images': async (key) => {
      const id = crypto.randomUUID();
      await f.rows(
        `insert into public.products (id, slug, name, images) values ($1, $2, 'T', $3::jsonb)`,
        [id, `s-${id}`, jsonKey(key)],
      );
      return id;
    },
    'product_modifications.images': async (key) => {
      const id = crypto.randomUUID();
      await f.rows(
        `insert into public.product_modifications (id, product_id, slug, name, images)
         values ($1, $2, $3, 'M', $4::jsonb)`,
        [id, f.ids.panel, `m-${id}`, jsonKey(key)],
      );
      return id;
    },
    'product_reviews.images': (key) => d.seedReview({ images: [key] }),
    'sections.image_url': async (key) => {
      const id = crypto.randomUUID();
      await f.rows(
        `insert into public.sections (id, slug, name, image_url) values ($1, $2, 'S', $3)`,
        [id, `s-${id}`, key],
      );
      return id;
    },
    'property_options.image_url': async (key) => {
      const prop = crypto.randomUUID();
      await f.rows(
        `insert into public.section_properties (id, name, slug) values ($1, 'P', $2)`,
        [prop, `p-${prop}`],
      );
      const id = crypto.randomUUID();
      await f.rows(
        `insert into public.property_options (id, property_id, name, slug, image_url)
         values ($1, $2, 'O', $3, $4)`,
        [id, prop, `o-${id}`, key],
      );
      return id;
    },
    'profiles.avatar_url': async (key) => {
      const user = await d.seedUser('Аватар', ['А', 'Б']);
      await f.rows(
        `update public.profiles set avatar_url = $2 where user_id = $1`,
        [user, key],
      );
      const [row] = await f.rows<{ id: string }>(
        `select id from public.profiles where user_id = $1`,
        [user],
      );
      return row!.id;
    },
  };
  for (const column of ['image_url', 'desktop_image_url', 'mobile_image_url'])
    SEEDERS[`banners.${column}`] = async (key) => {
      const id = crypto.randomUUID();
      const cols = new Set([column, 'image_url']);
      const names = [...cols];
      await f.rows(
        `insert into public.banners (id, title, ${names.join(', ')})
         values ($1, 'B', ${names.map((_, i) => `$${i + 2}`).join(', ')})`,
        [id, ...names.map(() => key)],
      );
      return id;
    };

  it('парність: кожен запис MEDIA_COLUMNS має сіятель, а kind збігається з типом колонки в БД', async () => {
    for (const { table, column, kind } of MEDIA_COLUMNS) {
      expect(SEEDERS, `немає сіятеля для ${table}.${column}`).toHaveProperty([
        `${table}.${column}`,
      ]);
      const [meta] = await f.rows<{ data_type: string }>(
        `select data_type from information_schema.columns
          where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [table, column],
      );
      expect(meta?.data_type, `${table}.${column}: kind ≠ тип у БД`).toBe(kind);
    }
  });

  for (const { table, column } of MEDIA_COLUMNS) {
    it(`знаходить посилання в ${table}.${column}`, async () => {
      const key = fresh();
      const id = await SEEDERS[`${table}.${column}`]!(key);
      const found = await find(key);
      expect(found).toContainEqual({ table, column, id });
    });
  }

  it('логотип: system_settings.value.logo', async () => {
    const key = fresh();
    const id = crypto.randomUUID();
    await f.rows(
      `insert into public.system_settings (id, key, value) values ($1, 'store_profile', $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [id, JSON.stringify({ name: 'X', logo: key })],
    );
    const found = await find(key);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      table: 'system_settings',
      column: 'value.logo',
    });
    await f.rows(
      `delete from public.system_settings where key = 'store_profile'`,
    );
  });

  it('неприв’язаний ключ — порожньо; підрядок у jsonb не збігається', async () => {
    const key = fresh();
    await SEEDERS['products.images']!(`${key}.bak`);
    expect(await find(key)).toEqual([]);
  });
});
