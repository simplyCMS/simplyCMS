// Showcase Task 2 (С-2, С-15): db-варіанти операцій фабрики ресурсів
// (`insertIn`/`updateIn`/`removeIn`) працюють поза HTTP-запитом — у транзакції
// викликача під `withActor({ role: 'app_admin' })`, без `requireGrant`. Інваріанти
// фабрики (strip readonly, lock → guard) мусять триматися так само, як в операції.
// БД — фікстура доставки (канон без сіду доставки, сід свій у тесті).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIPPING_PROVIDER } from 'simplycms/contracts/shipping-providers';
import * as F from './fixtures/admin-shipping';

// Операція `insert` (для порівняння guard-а) ставить 409 через межу — мок
// дозволяє її кликати поза запитом і заодно доводить, що `*In` статус не чіпає.
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setResponseStatus } from '@tanstack/react-start/server';
import { withActor, type ActorDb } from 'simplycms/db';
import {
  pickupPointsOps,
  priceTypesOps,
  sectionsOps,
} from 'simplycms/admin-server/impl';

const asAdmin = <T>(fn: (db: ActorDb) => Promise<T>) =>
  withActor({ role: 'app_admin' }, fn);
let n = 0;
const section = () => ({
  id: crypto.randomUUID(),
  slug: `showcase-in-${++n}`,
  name: `Розділ ${n}`,
});

describe('фабрика ресурсів: db-варіанти поза запитом (showcase Task 2)', () => {
  const db = F.useShippingAdminDb('simplycms_admin_resource_in');
  const url = () => db.url();
  const sectionRow = async (id: string) =>
    (
      await F.rows(url(), `select name from public.sections where id = $1`, [
        id,
      ])
    )[0];
  beforeEach(() => vi.mocked(setResponseStatus).mockClear());

  it('sectionsOps.insertIn під app_admin створює розділ і повертає рядок', async () => {
    const s = section();
    const out = await asAdmin((tx) => sectionsOps.insertIn(tx, [s]));
    expect(out).toMatchObject([{ id: s.id, slug: s.slug, name: s.name }]);
    expect(await sectionRow(s.id)).toEqual({ name: s.name });
  });

  it('updateIn і removeIn — у транзакції викликача', async () => {
    const s = section();
    await asAdmin((tx) => sectionsOps.insertIn(tx, [s]));
    const upd = await asAdmin((tx) =>
      sectionsOps.updateIn(tx, [{ id: s.id, patch: { name: 'Нова назва' } }]),
    );
    expect(upd).toMatchObject([{ id: s.id, name: 'Нова назва' }]);
    expect(await sectionRow(s.id)).toEqual({ name: 'Нова назва' });
    const del = await asAdmin((tx) => sectionsOps.removeIn(tx, [{ id: s.id }]));
    expect(del).toEqual({ count: 1 });
    expect(await sectionRow(s.id)).toBeUndefined();
  });

  it('insertIn з readonly isDefault — поле відкинуто (тип ціни не дефолтний)', async () => {
    const id = crypto.randomUUID();
    const out = await asAdmin((tx) =>
      priceTypesOps.insertIn(tx, [
        { id, code: `showcase_in_${++n}`, name: 'Оптова', isDefault: true },
      ]),
    );
    expect(out).toMatchObject([{ id, isDefault: false }]);
    const [row] = await F.rows(
      url(),
      `select is_default from public.price_types where id = $1`,
      [id],
    );
    expect(row).toEqual({ is_default: false });
  });

  it('невалідний вхід insertIn → ValidationError без статусу відповіді', async () => {
    await expect(
      asAdmin((tx) => sectionsOps.insertIn(tx, [{ id: 'не-uuid' }])),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it('guard доставки спрацьовує через insertIn так само, як через insert', async () => {
    const methodId = await F.seedMethod(url(), SHIPPING_PROVIDER.address);
    const point = () => ({
      id: crypto.randomUUID(),
      methodId,
      name: `Точка ${++n}`,
      address: 'вул. Показова, 1',
      city: 'Київ',
    });
    const viaIn = point();
    const viaOp = point();
    const invalid = F.conflict('state', 'pickup_point_method_invalid');
    await expect(
      asAdmin((tx) => pickupPointsOps.insertIn(tx, [viaIn])),
    ).rejects.toMatchObject(invalid);
    // Ядро поза запитом статус не ставить (С-10) — його ставить лише межа операції.
    expect(setResponseStatus).not.toHaveBeenCalled();
    await expect(
      pickupPointsOps.insert({ data: [viaOp] }),
    ).rejects.toMatchObject(invalid);
    expect(setResponseStatus).toHaveBeenCalledWith(409);
    const [{ n: left }] = await F.rows(
      url(),
      `select count(*)::int n from public.pickup_points where id = any($1::uuid[])`,
      [[viaIn.id, viaOp.id]],
    );
    expect(left).toBe(0);
  });
});
