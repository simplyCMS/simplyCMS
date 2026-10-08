/**
 * План замовлень сіду (С-3, С-4) — чиста функція PRNG і довідників, без IO.
 *
 * Що план гарантує ЗА ПОБУДОВОЮ (а не випадково вдалим seed-ом):
 * - VIP-кандидати мають ≥ `VIP_ORDERS_THRESHOLD` замовлень і жодне з них не
 *   скасоване — автоправило справді переводить ≥2 покупців (асерт гейта (е));
 * - закріплений покупець має стільки ж замовлень — і лишається у своїй
 *   категорії лише завдяки `locked`;
 * - кожен статус магазину трапляється хоча б раз (інакше — виняток).
 *
 * 🔴 День-зсув (0–29) задає і статус (старі — доставлені, свіжі — нові), і
 * порядок оформлення: план сортується від найстаршого, тож номери й історія
 * категорій ідуть у тому самому порядку, що й дати після зсуву (С-3).
 */
import type { Person } from './people.mts';
import type { SaleTarget } from './commerce.mts';
import { VIP_ORDERS_THRESHOLD } from './loyalty.mts';
import { int, pick, type Rand } from './prng.mts';

export const STATUS_CODES = [
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type StatusCode = (typeof STATUS_CODES)[number];

export type Delivery =
  | { readonly kind: 'pickup'; readonly point: 'system' | 'second' }
  | {
      readonly kind: 'courier';
      readonly city: string;
      readonly address: string;
    };

export type PlannedOrder = {
  /** Індекс покупця в `people.buyers`; `null` — гість. */
  readonly buyer: number | null;
  /** Контакти замовлення (покупця чи гостя). */
  readonly person: Person;
  readonly dayShift: number;
  readonly status: StatusCode;
  readonly delivery: Delivery;
  readonly items: readonly {
    readonly target: SaleTarget;
    readonly quantity: number;
  }[];
};

/** Ролі покупців за індексом — їх читають і план, і сценарії Е6г. */
export const ROLES = {
  vip: [0, 1],
  locked: 2,
  banned: 16,
  deleted: 17,
} as const;
export const GUEST_COUNT = 10;

const CITIES = 'Київ Львів Одеса Харків Дніпро Вінниця Полтава'.split(' ');
const STREETS =
  'Шевченка;Франка;Соборна;Незалежності;Садова;Лесі Українки'.split(';');
// Статуси за віком замовлення: свіжі ще в роботі, старі — доставлені.
const BY_AGE: readonly (readonly [number, readonly StatusCode[]])[] = [
  [14, ['delivered', 'delivered', 'delivered', 'shipped', 'cancelled']],
  [5, ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']],
  [0, ['new', 'new', 'confirmed', 'processing', 'cancelled']],
];

function ordersOf(rand: Rand, index: number): number {
  if ((ROLES.vip as readonly number[]).includes(index))
    return VIP_ORDERS_THRESHOLD + 1;
  if (index === ROLES.locked) return VIP_ORDERS_THRESHOLD;
  if (index === ROLES.deleted) return 2;
  return int(rand, 0, 2);
}

function statusOf(rand: Rand, dayShift: number, noCancel: boolean): StatusCode {
  const bucket = BY_AGE.find(([from]) => dayShift >= from)![1];
  const status = pick(rand, bucket);
  return status === 'cancelled' && noCancel ? bucket[0]! : status;
}

function itemsOf(rand: Rand, targets: readonly SaleTarget[]) {
  const count = int(rand, 1, 3);
  const chosen = new Map<string, SaleTarget>();
  while (chosen.size < count) {
    const target = pick(rand, targets);
    chosen.set(target.key, target);
  }
  return [...chosen.values()].map((target) => ({
    target,
    // Кожен п'ятий рядок — 3–4 шт.: так знижка «від 3 шт» має що показати.
    quantity: rand() < 0.2 ? int(rand, 3, 4) : int(rand, 1, 2),
  }));
}

function deliveryOf(rand: Rand): Delivery {
  if (rand() < 0.45)
    return { kind: 'pickup', point: rand() < 0.5 ? 'system' : 'second' };
  return {
    kind: 'courier',
    city: pick(rand, CITIES),
    address: `вул. ${pick(rand, STREETS)}, ${int(rand, 1, 120)}`,
  };
}

export function planOrders(
  rand: Rand,
  buyers: readonly Person[],
  guests: readonly Person[],
  targets: readonly SaleTarget[],
): PlannedOrder[] {
  const owners: { buyer: number | null; person: Person; noCancel: boolean }[] =
    [];
  buyers.forEach((person, buyer) => {
    const count = ordersOf(rand, buyer);
    const noCancel = count >= VIP_ORDERS_THRESHOLD;
    for (let i = 0; i < count; i++) owners.push({ buyer, person, noCancel });
  });
  for (const person of guests)
    owners.push({ buyer: null, person, noCancel: false });

  const plan = owners.map(({ buyer, person, noCancel }) => {
    const dayShift = int(rand, 0, 29);
    return {
      buyer,
      person,
      dayShift,
      status: statusOf(rand, dayShift, noCancel),
      delivery: deliveryOf(rand),
      items: itemsOf(rand, targets),
    };
  });
  const missing = STATUS_CODES.filter(
    (code) => !plan.some((o) => o.status === code),
  );
  if (missing.length > 0)
    throw new Error(`[showcase] план без статусів: ${missing.join(', ')}`);
  // Стабільне сортування: рівний зсув зберігає порядок плану.
  return plan.sort((a, b) => b.dayShift - a.dayShift);
}
