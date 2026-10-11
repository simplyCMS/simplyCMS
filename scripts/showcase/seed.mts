/**
 * Модуль сіду вітрини: `seedShowcase(env)` кличуть і команда (`run.mts`), і
 * гейт С-8 — з явним env, без глобального стану команди.
 *
 * 🔴 Перший крок — guard С-16б (`assertPristine`), ДО будь-якого запису.
 * Далі (С-2, С-12): люди — штатним Better Auth; каталог, торгівля, статуси й
 * сценарії Е6г — ядрами під `withActor({ role: 'app_admin' })` поверх
 * `app_runtime`-підключення з `env.databaseUrl`; замовлення й відгуки — як
 * вітрина (`placeOrderFor`, `withCustomerDb`). Наприкінці — схвалення
 * відгуків ядром модерації (Е6д-7) і єдиний позначений сирий запис
 * (`raw-writes.mts`): зсув часу.
 *
 * 🔴 Порядок має значення: зсув часу — останнім (після статусів, бо
 * `changeOrderStatus` ставить `updated_at`), видалення покупця — після його
 * замовлень, відгуку й аватара, файли якого стираються вже після зовнішньої
 * транзакції (Е6д-14); схваленню порядок байдужий (схвалюються `id`
 * з `insertProductReview`, зокрема вже анонімний відгук видаленого).
 */
import { sql } from 'drizzle-orm';
import { setReviewsStatus } from '../../packages/simplycms/src/admin-server/impl/index.ts';
import { withActor } from '../../packages/simplycms/src/db/index.ts';
import { completeMediaErasures } from '../../packages/simplycms/src/storage/index.ts';
import { seedCatalog } from './catalog.mts';
import { seedCommerce } from './commerce.mts';
import { applyProcessEnv, type ShowcaseEnv } from './env.mts';
import { assertPristine } from './guard.mts';
import { seedGuestVisibleMedia } from './guest-media.mts';
import { seedLoyalty } from './loyalty.mts';
import { GUEST_COUNT, planOrders, ROLES } from './orders-plan.mts';
import { applyStatuses, placeOrders } from './orders.mts';
import { personOf, seedPeople, type People } from './people.mts';
import { int } from './prng.mts';
import {
  REGISTRATION_MIN_DAYS,
  shiftTime,
  type DayShift,
} from './raw-writes.mts';
import {
  seedCustomerScenarios,
  seedDeletedAvatar,
  seedReviews,
} from './scenarios.mts';
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
  const reviewIds = await seedReviews(stream('reviews'), placed);
  await seedDeletedAvatar(ctx, people);

  const discard = await withActor(ADMIN, async (db) => {
    const keys = await seedCustomerScenarios(db, people);
    // Ядро модерації (Е6д-7), а не сирий UPDATE; `id` — від `insertProductReview`.
    // Перший відгук — видалюваного покупця, тож фото кладемо на другий.
    await seedGuestVisibleMedia(db, ctx, reviewIds[1]!);
    // Е6д-23: модерація звіряє версію — беремо її з рядків, які щойно вставили
    // (мілісекунди, як віддає картка адмінки).
    const versions = await db.execute<{ id: string; updatedAt: string }>(sql`
      select id, to_char(date_trunc('milliseconds', updated_at) at time zone 'utc',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "updatedAt"
        from public.product_reviews
       where id in (${sql.join(
         reviewIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})`);
    await setReviewsStatus(db, { items: versions.rows, status: 'approved' });
    await shiftTime(
      db,
      placed.map((order) => ({ id: order.id, days: order.dayShift })),
      registrations(people),
    );
    return keys;
  });
  // Друга фаза стирання (Е6д-14) — лише ПІСЛЯ COMMIT: відкат зовнішньої
  // транзакції лишає файли аватара цілими разом із рядками.
  await completeMediaErasures(discard, env.media);
}

/**
 * День-зсув реєстрації: адміни — найраніші (магазин стартував з них),
 * покупці — з PRNG, але раніше за будь-яке своє замовлення. Видалений
 * покупець рядка `users` уже не має.
 */
function registrations(people: People): DayShift[] {
  const rand = stream('registrations');
  const buyers = people.buyers
    .filter((_, index) => index !== ROLES.deleted)
    .map((b) => ({
      id: b.id,
      days: int(rand, REGISTRATION_MIN_DAYS, REGISTRATION_MIN_DAYS + 14),
    }));
  return [
    { id: people.ownerId, days: REGISTRATION_MIN_DAYS + 30 },
    { id: people.managerId, days: REGISTRATION_MIN_DAYS + 20 },
    ...buyers,
  ];
}
