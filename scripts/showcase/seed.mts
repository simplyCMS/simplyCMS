/**
 * Модуль сіду вітрини: `seedShowcase(env)` кличуть і команда (`run.mts`), і
 * гейт С-8 — з явним env, без глобального стану команди.
 *
 * 🔴 Перший крок — guard С-16б (`assertPristine`), ДО будь-якого запису.
 * Далі (С-2, С-12): люди — штатним Better Auth; каталог, торгівля, статуси й
 * сценарії Е6г — ядрами під `withActor({ role: 'app_admin' })` поверх
 * `app_runtime`-підключення з `env.databaseUrl`; замовлення й відгуки — як
 * вітрина (`placeOrderFor`, `withCustomerDb`). Наприкінці — два позначені
 * сирі записи (`raw-writes.mts`): схвалення відгуків і зсув часу.
 *
 * 🔴 Порядок має значення: зсув часу — останнім (після статусів, бо
 * `changeOrderStatus` ставить `updated_at`), видалення покупця — після його
 * замовлень і відгуку; схваленню порядок байдужий (схвалюються всі
 * `pending`, зокрема вже анонімний відгук видаленого).
 */
import { withActor } from '../../packages/simplycms/src/db/index.ts';
import { seedCatalog } from './catalog.mts';
import { seedCommerce } from './commerce.mts';
import { applyProcessEnv, type ShowcaseEnv } from './env.mts';
import { assertPristine } from './guard.mts';
import { seedLoyalty } from './loyalty.mts';
import { GUEST_COUNT, planOrders, ROLES } from './orders-plan.mts';
import { applyStatuses, placeOrders } from './orders.mts';
import { personOf, seedPeople } from './people.mts';
import { approveReviews, shiftTime } from './raw-writes.mts';
import { seedCustomerScenarios, seedReviews } from './scenarios.mts';
import { stream, type SeedContext } from './seed-context.mts';

const ADMIN = { role: 'app_admin' } as const;

export async function seedShowcase(env: ShowcaseEnv): Promise<void> {
  applyProcessEnv(env);
  await withActor(ADMIN, (db) => assertPristine(db));

  const people = await seedPeople(env);
  const ctx: SeedContext = { media: env.media, ownerId: people.ownerId };
  const commerce = await withActor(ADMIN, async (db) => {
    const catalog = await seedCatalog(db, ctx);
    const result = await seedCommerce(db, catalog);
    await seedLoyalty(db, {
      wholesaleId: result.wholesaleId,
      ownerId: people.ownerId,
      lockedBuyerId: people.buyers[ROLES.locked]!.id,
    });
    return result;
  });

  const rand = stream('orders');
  const guests = Array.from({ length: GUEST_COUNT }, (_, i) =>
    personOf(rand, `guest-${String(i + 1).padStart(2, '0')}@showcase.test`),
  );
  const plan = planOrders(rand, people.buyers, guests, commerce.targets);
  const placed = await placeOrders(plan, people, commerce.shipping);
  await withActor(ADMIN, (db) => applyStatuses(db, placed));
  await seedReviews(stream('reviews'), placed);

  await withActor(ADMIN, async (db) => {
    await seedCustomerScenarios(db, people);
    await approveReviews(db);
    await shiftTime(
      db,
      placed.map((order) => ({ id: order.id, days: order.dayShift })),
    );
  });
}
