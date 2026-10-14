// К3-Е8, Task 5: «рівно одна основна зона доставки» тримає БД, а не лише
// операції адмінки. Три шари: часткові індекс (≤1), CHECK «основна активна»
// й відкладений constraint-тригер (≥1) — і окремий доказ, що операції
// відмовляють РАНІШЕ за БД (`AdminConflictError`, а не помилка Postgres).
import pg from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_SHIPPING_ZONE_ID } from 'simplycms/schema';
import * as F from './fixtures/admin-shipping';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  removeShippingZonesOp,
  setDefaultShippingZoneOp,
  shippingZonesOps,
} from 'simplycms/admin-server/impl';

const MAIN = MAIN_SHIPPING_ZONE_ID;
const NO_DEFAULT = 'shipping_zones: потрібна рівно одна основна зона';

/** Відкрита транзакція окремого зʼєднання: тест сам вирішує, що й коли комітити. */
async function inTx<T>(
  url: string,
  fn: (
    q: (sql: string, p?: unknown[]) => Promise<pg.QueryResult>,
  ) => Promise<T>,
) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    return await fn((sql, p) => client.query(sql, p));
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end();
  }
}

const defaults = async (url: string) =>
  (
    await F.rows(url, `select id from public.shipping_zones where is_default`)
  ).map((r) => r.id);

describe('БД: інваріант основної зони доставки (К3-Е8, Task 5)', () => {
  const db = F.useShippingAdminDb('simplycms_shipping_zone_invariant');
  const url = () => db.url();

  beforeEach(async () => {
    // Без тригера (мутація) кейс «delete основної» її справді видалив би, і
    // каскад завалив би решту — повертаємо рядок, щоб кожен кейс падав сам.
    await F.rows(
      url(),
      `insert into public.shipping_zones (id, name, is_default) values ($1, 'Основна зона', false)
       on conflict (id) do nothing`,
      [MAIN],
    );
    await F.makeDefaultZone(url(), MAIN);
  });

  it('після накату — рівно одна зона: сід, основна й активна', async () => {
    const fresh = await F.rows(
      url(),
      `select id, is_default, is_active from public.shipping_zones where id = $1`,
      [MAIN],
    );
    expect(fresh).toEqual([{ id: MAIN, is_default: true, is_active: true }]);
    expect(await defaults(url())).toEqual([MAIN]);
  });

  it('delete основної в транзакції → 23514 на COMMIT', async () => {
    await expect(
      inTx(url(), async (q) => {
        await q(`delete from public.shipping_zones where id = $1`, [MAIN]);
        await q('commit');
      }),
    ).rejects.toMatchObject({ code: '23514', message: NO_DEFAULT });
    expect(await defaults(url())).toEqual([MAIN]);
  });

  it('зняти is_default з єдиної основної → 23514 на COMMIT', async () => {
    await expect(
      inTx(url(), async (q) => {
        await q(
          `update public.shipping_zones set is_default = false where id = $1`,
          [MAIN],
        );
        await q('commit');
      }),
    ).rejects.toMatchObject({ code: '23514', message: NO_DEFAULT });
    expect(await defaults(url())).toEqual([MAIN]);
  });

  it('вимкнути основну (is_active = false) → 23514 від CHECK одразу', async () => {
    await expect(
      F.rows(
        url(),
        `update public.shipping_zones set is_active = false where id = $1`,
        [MAIN],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'shipping_zones_default_active',
    });
  });

  it('insert другої основної → 23505 (частковий унікальний індекс)', async () => {
    await expect(
      F.rows(
        url(),
        `insert into public.shipping_zones (id, name, is_default) values (gen_random_uuid(), 'Друга', true)`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('заміна основної через setDefaultShippingZoneOp комітиться, основна — нова', async () => {
    const target = await F.seedZone(url());
    await setDefaultShippingZoneOp({ data: { id: target } });
    expect(await defaults(url())).toEqual([target]);
  });

  it('заміна двома UPDATE в ОДНІЙ транзакції комітиться (доказ DEFERRED)', async () => {
    const target = await F.seedZone(url());
    await inTx(url(), async (q) => {
      await q(
        `update public.shipping_zones set is_default = false where id = $1`,
        [MAIN],
      );
      await q(
        `update public.shipping_zones set is_default = true where id = $1`,
        [target],
      );
      await q('commit');
    });
    expect(await defaults(url())).toEqual([target]);
  });

  it('операції адмінки відмовляють доменним AdminConflictError, не помилкою БД', async () => {
    await expect(
      removeShippingZonesOp({ data: [{ id: MAIN }] }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_default'));
    await expect(
      shippingZonesOps.update({
        data: [{ id: MAIN, patch: { isActive: false } }],
      }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_default'));
    const inactive = await F.seedZone(url(), false);
    await expect(
      setDefaultShippingZoneOp({ data: { id: inactive } }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_inactive'));
    expect(await defaults(url())).toEqual([MAIN]);
  });
});

describe('операції: гард раніше за тригер і CHECK (К3-Е8, Task 5)', () => {
  const db = F.useShippingAdminDb('simplycms_shipping_zone_guard');
  const url = () => db.url();

  // Тригер і CHECK знімаються НАЗАВЖДИ в цій окремій БД: операції ходять у
  // власних зʼєднаннях, тож тест-транзакція їх би не побачила. Якщо відмову
  // давала б БД, а не операція, рядок тут змінився б — і тест би впав.
  it('без тригера й CHECK ті самі три операції однаково → AdminConflictError, рядок незмінний', async () => {
    await inTx(url(), async (q) => {
      await q(
        `drop trigger shipping_zones_require_default on public.shipping_zones`,
      );
      await q(
        `alter table public.shipping_zones drop constraint shipping_zones_default_active`,
      );
      await q('commit');
    });
    const inactive = await F.seedZone(url(), false);
    const before = await F.rows(
      url(),
      `select id, is_default, is_active from public.shipping_zones order by id`,
    );

    await expect(
      removeShippingZonesOp({ data: [{ id: MAIN }] }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_default'));
    await expect(
      shippingZonesOps.update({
        data: [{ id: MAIN, patch: { isActive: false } }],
      }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_default'));
    await expect(
      setDefaultShippingZoneOp({ data: { id: inactive } }),
    ).rejects.toMatchObject(F.conflict('state', 'shipping_zone_inactive'));

    expect(
      await F.rows(
        url(),
        `select id, is_default, is_active from public.shipping_zones order by id`,
      ),
    ).toEqual(before);
  });
});
