/**
 * Відгуки й сценарії Е6г сіду (С-4).
 *
 * - Відгуки — від імені покупця (`withCustomerDb` + `insertProductReview`):
 *   ті самі RLS і санітизація, що на вітрині; лише на куплені товари, по
 *   одному на пару товар/покупець (унікальний ключ таблиці). Схвалює їх
 *   позначений сирий запис (`raw-writes.mts`, С-11).
 * - Бан і видалення — ядрами адмінки. Видалення — ПІСЛЯ замовлень і
 *   відгуків: сценарій саме про покупця, чиї замовлення знеособлюються, а
 *   відгук стає анонімним.
 */
import {
  deleteCustomer,
  deleteCustomerInput,
  setCustomerBan,
  setCustomerBanInput,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { withCustomerDb } from '../../packages/simplycms/src/storefront/loaders/db.ts';
import { insertProductReview } from '../../packages/simplycms/src/storefront/loaders/reviews-write.ts';
import { ROLES } from './orders-plan.mts';
import type { PlacedOrder } from './orders.mts';
import type { People } from './people.mts';
import { int, pick, type Rand } from './prng.mts';

export const REVIEW_COUNT = 15;

const TITLES = [
  'Рекомендую',
  'Добре працює',
  'Як в описі',
  'Варте своїх грошей',
  'Є нюанси',
];
const CONTENTS = [
  'Доставили швидко, усе працює з першого дня.',
  'Якість збірки хороша, інструкція українською.',
  'Користуюсь місяць — без нарікань.',
  'Ціна трохи кусається, але товар того вартий.',
  'Хотілося б довший кабель у комплекті.',
];

type Pair = {
  readonly userId: string;
  readonly productId: string;
  readonly buyer: number;
};

/** Пари «покупець купив товар» у порядку оформлення, без повторів. */
function purchasedPairs(placed: readonly PlacedOrder[]): Pair[] {
  const seen = new Map<string, Pair>();
  for (const order of placed) {
    if (order.userId === null || order.buyer === null) continue;
    for (const { target } of order.items) {
      const key = `${order.userId}/${target.productId}`;
      if (!seen.has(key))
        seen.set(key, {
          userId: order.userId,
          productId: target.productId,
          buyer: order.buyer,
        });
    }
  }
  return [...seen.values()];
}

/**
 * ~15 відгуків: перший — від покупця, якого далі видалять (сценарій Е6г
 * потребує його відгуку), решта — випадкові пари без повторів.
 */
export async function seedReviews(
  rand: Rand,
  placed: readonly PlacedOrder[],
): Promise<number> {
  const pairs = purchasedPairs(placed);
  const first = pairs.find((p) => p.buyer === ROLES.deleted);
  if (!first)
    throw new Error('[showcase] видалюваний покупець нічого не купив');
  const chosen = [first];
  const rest = pairs.filter((p) => p !== first);
  while (chosen.length < REVIEW_COUNT && rest.length > 0) {
    chosen.push(rest.splice(int(rand, 0, rest.length - 1), 1)[0]!);
  }
  for (const pair of chosen) {
    const rating = rand() < 0.15 ? int(rand, 2, 3) : int(rand, 4, 5);
    const input = {
      productId: pair.productId,
      rating,
      title: pick(rand, TITLES),
      content: `<p>${pick(rand, CONTENTS)}</p>`,
      images: [],
    };
    await withCustomerDb(pair.userId, (db) =>
      insertProductReview(db, pair.userId, input),
    );
  }
  return chosen.length;
}

/** Бан і видалення покупців за ролями плану (`ROLES`). */
export async function seedCustomerScenarios(
  db: ActorDb,
  people: People,
): Promise<void> {
  const banned = people.buyers[ROLES.banned]!;
  await setCustomerBan(
    db,
    setCustomerBanInput.parse({
      userId: banned.id,
      banned: true,
      reason: 'Повторні неоплачені замовлення',
    }),
  );
  const deleted = people.buyers[ROLES.deleted]!;
  // `system`: сід — не адмін-сесія; перевірки «не адмін» і email діють так само.
  await deleteCustomer(
    db,
    deleteCustomerInput.parse({
      userId: deleted.id,
      confirmEmail: deleted.email,
    }),
    { kind: 'system' },
  );
}
