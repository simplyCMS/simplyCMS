// М2б Task 7 (Р19): агрегат «статус замовлення» — перша сутність на фабриці команд
// перекладного агрегата — проти живого Postgres під `app_admin`.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AdminConflictError,
  AdminNotFoundError,
  ValidationError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import {
  orderStatusesCreate,
  orderStatusesDeleteTranslation,
  orderStatusesGet,
  orderStatusesList,
  orderStatusesRemove,
  orderStatusesReorder,
  orderStatusesSaveDescription,
  orderStatusesSaveTranslation,
  orderStatusesSetDefault,
} from 'simplycms/admin-server/impl';
import { sourceFieldHash } from 'simplycms/translations';
import { useAddressingDb } from './fixtures/addressing-db';
import { exec } from './fixtures/product-aggregate';

type Texts = Record<string, Record<string, string | null>>;

describe('агрегат «статус замовлення» (М2б, Р19)', () => {
  const db = useAddressingDb('simplycms_order_statuses_aggregate');
  let sort = 1000;
  const rejects = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );

  beforeAll(async () => {
    await db.language('en');
  });

  /** Новий статус; `id` можна задати (порядок id у гонці замків). */
  const create = async (texts: Texts, extra: object = {}) => {
    const id = (extra as { id?: string }).id ?? randomUUID();
    const out = await exec(orderStatusesCreate, {
      code: `t-${id}`,
      sortOrder: sort++,
      ...extra,
      id,
      texts,
    });
    return { id, version: out.version };
  };
  const get = (id: string) => exec(orderStatusesGet, { id });
  const row = async (id: string) =>
    (
      await db.q(
        `select version, is_default, sort_order from public.order_statuses where id = $1`,
        [id],
      )
    )[0]!;

  it('create з uk і en → get віддає обидві мови зі статусом current', async () => {
    const { id, version } = await create({
      uk: { name: 'Новий тест' },
      en: { name: 'New test' },
    });
    expect(version).toBe(1);
    const got = await get(id);
    expect(got.version).toBe(1);
    expect(got.texts.uk).toMatchObject({
      name: 'Новий тест',
      status: 'current',
    });
    expect(got.texts.en).toMatchObject({ name: 'New test', status: 'current' });
    expect(got.base).toMatchObject({ color: '#6B7280' });
  });

  it('create без основної мови → validation зі шляхом texts.uk.name; name — не колонка бази', async () => {
    const err = await rejects(create({ en: { name: 'Only en' } }));
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0]?.path).toEqual([
      'texts',
      'uk',
      'name',
    ]);
    const err2 = await rejects(create({ uk: {} }));
    expect((err2 as ValidationError).issues[0]?.path).toEqual([
      'texts',
      'uk',
      'name',
    ]);
    const cols = await db.q(
      `select 1 from information_schema.columns
        where table_name = 'order_statuses' and column_name = 'name'`,
    );
    expect(cols).toEqual([]);
  });

  it('saveDescription лише uk → en outdated (сценарій 1)', async () => {
    const { id, version } = await create({
      uk: { name: 'Було' },
      en: { name: 'Was' },
    });
    const out = await exec(orderStatusesSaveDescription, {
      id,
      expectedVersion: version,
      texts: { uk: { name: 'Стало' } },
    });
    expect(out.version).toBe(2);
    const en = (await get(id)).texts.en!;
    expect(en.status).toBe('outdated');
    expect(en.fieldStatus).toMatchObject({ name: 'outdated' });
  });

  it('saveTranslation en з хешем нового джерела → current', async () => {
    const { id, version } = await create({
      uk: { name: 'Було' },
      en: { name: 'Was' },
    });
    const v2 = (
      await exec(orderStatusesSaveDescription, {
        id,
        expectedVersion: version,
        texts: { uk: { name: 'Стало' } },
      })
    ).version;
    const out = await exec(orderStatusesSaveTranslation, {
      id,
      locale: 'en',
      expectedVersion: v2,
      fields: { name: 'Became' },
      expectedSourceHashes: { name: sourceFieldHash('Стало') },
    });
    expect(out.version).toBe(v2 + 1);
    expect((await get(id)).texts.en!.status).toBe('current');
  });

  it('deleteTranslation основної мови → validation (400); не-основної — проходить', async () => {
    const { id, version } = await create({
      uk: { name: 'А' },
      en: { name: 'A' },
    });
    const err = await rejects(
      exec(orderStatusesDeleteTranslation, {
        id,
        locale: 'uk',
        expectedVersion: version,
      }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    const out = await exec(orderStatusesDeleteTranslation, {
      id,
      locale: 'en',
      expectedVersion: version,
    });
    expect(out.version).toBe(version + 1);
    expect((await get(id)).texts.en).toBeUndefined();
  });

  it('старий expectedVersion → VersionMismatchError зі справжньою версією', async () => {
    const { id, version } = await create({ uk: { name: 'Версія' } });
    await exec(orderStatusesSaveDescription, {
      id,
      expectedVersion: version,
      base: { color: '#111111' },
    });
    const err = await rejects(
      exec(orderStatusesSaveDescription, {
        id,
        expectedVersion: version,
        base: { color: '#222222' },
      }),
    );
    expect(err).toBeInstanceOf(VersionMismatchError);
    expect((err as VersionMismatchError).currentVersion).toBe(2);
  });

  it('setDefault(A) піднімає version A і колишнього дефолту', async () => {
    const a = await create({ uk: { name: 'A' } });
    const [{ id: prevId }] = (await db.q(
      `select id from public.order_statuses where is_default`,
    )) as { id: string }[];
    const prev = await row(prevId!);
    const out = await exec(orderStatusesSetDefault, {
      id: a.id,
      expectedVersion: a.version,
    });
    expect(out.version).toBe(a.version + 1);
    expect(await row(a.id)).toMatchObject({
      is_default: true,
      version: a.version + 1,
    });
    expect(await row(prevId!)).toMatchObject({
      is_default: false,
      version: (prev.version as number) + 1,
    });
    const defaults = await db.q(
      `select id from public.order_statuses where is_default`,
    );
    expect(defaults).toHaveLength(1);
  });

  it('reorder піднімає version обох рядків; на краю — no-op без версії', async () => {
    const a = await create({ uk: { name: 'Ра' } });
    const c = await create({ uk: { name: 'Рс' } });
    const out = await exec(orderStatusesReorder, {
      id: a.id,
      direction: 'down',
      expectedVersion: a.version,
    });
    expect(out).toEqual({ version: a.version + 1, swapped: true });
    expect((await row(c.id)).version).toBe(c.version + 1);
    expect((await row(a.id)).sort_order).toBeGreaterThan(
      (await row(c.id)).sort_order as number,
    );
    const [{ id: lastId }] = (await db.q(
      `select id from public.order_statuses order by sort_order desc limit 1`,
    )) as { id: string }[];
    const last = await row(lastId!);
    const edge = await exec(orderStatusesReorder, {
      id: lastId!,
      direction: 'down',
      expectedVersion: last.version,
    });
    expect(edge).toEqual({ version: last.version, swapped: false });
  });

  it('20 пар setDefault(A) / reorder(A↔C) — жодного 40P01, рівно один is_default', async () => {
    // Порядок id важливий: A < C за id, тож зустрічний порядок замків дав би цикл.
    const A = `aaaaaaaa-${randomUUID().slice(9)}`;
    const C = `cccccccc-${randomUUID().slice(9)}`;
    await create({ uk: { name: 'Гонка A' } }, { id: A });
    await create({ uk: { name: 'Гонка C' } }, { id: C });
    // 20 пар одночасно (а не послідовно): вікно між двома замками вузьке, а так учасники
    // гарантовано перетинаються. Програш гонки версії (412) допустимий — він настає ПІСЛЯ
    // замків; цикл замків (40P01) — ні.
    const vA = (await row(A)).version as number;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => [
        exec(orderStatusesSetDefault, { id: A, expectedVersion: vA }),
        exec(orderStatusesReorder, {
          id: A,
          direction: i % 2 === 0 ? 'down' : 'up',
          expectedVersion: vA,
        }),
      ]).flat(),
    );
    for (const r of results)
      if (r.status === 'rejected')
        expect(r.reason).toBeInstanceOf(VersionMismatchError);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.q(`select id from public.order_statuses where is_default`),
    ).toHaveLength(1);
  });

  it('remove статусу з посиланням із orders → 409 reference', async () => {
    const { id, version } = await create({ uk: { name: 'Із замовленням' } });
    await db.q(
      `insert into public.orders (id, order_number, status_id, subtotal, total, first_name, last_name, email, phone, payment_method)
       values ($1, $2, $3, 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
      [randomUUID(), `ST-${id.slice(0, 8)}`, id],
    );
    const err = await rejects(
      exec(orderStatusesRemove, { id, expectedVersion: version }),
    );
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({ kind: 'reference' });
    expect(await row(id)).toBeDefined();
  });

  it('remove дефолтного й системного → 409 state; звичайного — проходить разом із перекладами', async () => {
    const [def] = (await db.q(
      `select id, version from public.order_statuses where is_default`,
    )) as { id: string; version: number }[];
    const errDefault = await rejects(
      exec(orderStatusesRemove, { id: def!.id, expectedVersion: def!.version }),
    );
    expect(errDefault).toMatchObject({
      kind: 'state',
      constraint: 'order_status_default',
    });
    const [cancelled] = (await db.q(
      `select id, version from public.order_statuses where code = 'cancelled'`,
    )) as { id: string; version: number }[];
    const errSystem = await rejects(
      exec(orderStatusesRemove, {
        id: cancelled!.id,
        expectedVersion: cancelled!.version,
      }),
    );
    expect(errSystem).toMatchObject({
      kind: 'state',
      constraint: 'order_status_system',
    });
    const plain = await create({
      uk: { name: 'Зайвий' },
      en: { name: 'Extra' },
    });
    await exec(orderStatusesRemove, {
      id: plain.id,
      expectedVersion: plain.version,
    });
    expect(
      await db.q(
        `select 1 from public.order_status_translations where status_id = $1`,
        [plain.id],
      ),
    ).toEqual([]);
  });

  it('setDefault на неіснуючий id → NotFound, магазин НЕ лишається без дефолту', async () => {
    const before = await db.q(
      `select id from public.order_statuses where is_default`,
    );
    const err = await rejects(
      exec(orderStatusesSetDefault, { id: randomUUID(), expectedVersion: 1 }),
    );
    expect(err).toBeInstanceOf(AdminNotFoundError);
    expect(
      await db.q(`select id from public.order_statuses where is_default`),
    ).toEqual(before);
  });

  it('code незмінний (Е5-6): saveDescription з code у base → validation, код лишився', async () => {
    const { id, version } = await create({ uk: { name: 'Код' } });
    const err = await rejects(
      exec(orderStatusesSaveDescription, {
        id,
        expectedVersion: version,
        base: { code: 'renamed' },
      }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect(
      (
        await db.q(`select code from public.order_statuses where id = $1`, [id])
      )[0],
    ).toEqual({ code: `t-${id}` });
  });

  it('list: рядок з назвою основної мови, версією й без часових відбитків; порядок за sortOrder', async () => {
    const rows = await exec(orderStatusesList, {});
    const first = rows[0]!;
    expect(first).toMatchObject({ code: 'new', name: 'Новий' });
    expect(Object.keys(first).sort()).toEqual(
      [
        'code',
        'color',
        'id',
        'isDefault',
        'name',
        'sortOrder',
        'version',
      ].sort(),
    );
    const orders = rows.map((r) => r.sortOrder);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
  });
});
