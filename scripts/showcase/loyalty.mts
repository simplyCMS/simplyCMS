/**
 * Категорії покупців, автоправило й знижки сіду (С-4).
 *
 * - «VIP» і «Партнери» — тип ціни «Оптова»;
 * - правило «`orders_count >= 3` → VIP» з БУДЬ-ЯКОЇ категорії: тому ручне
 *   закріплення (`locked`) справді щось доводить — без нього правило
 *   перевело б і партнера;
 * - знижки «від 3 шт −10%» на розділ кабелів і «VIP −5%» за умовою
 *   `user_category in [VIP]` в одній групі `and` (діють разом).
 *
 * 🔴 Ядра `saveDiscount`/`assignCustomerCategory` довіряють розібраному входу —
 * вхід іде через їхні Zod-схеми. Ручне закріплення робить власник
 * (`{ kind: 'admin' }`): історія категорії показує автора дії.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  assignCustomerCategory,
  assignCustomerCategoryInput,
  categoryRulesOps,
  discountGroupsOps,
  saveDiscount,
  saveDiscountInput,
  userCategoriesOps,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { sections } from '../../packages/simplycms/src/schema/index.ts';

/** Розділ знижки «від 3 шт» — з довідника сіду (`catalog-data.mts`). */
const BULK_SECTION_SLUG = 'kabeli-ta-kriplennya';
/** Поріг автоправила: стільки нескасованих замовлень робить покупця VIP. */
export const VIP_ORDERS_THRESHOLD = 3;

export type LoyaltyInput = {
  readonly wholesaleId: string;
  readonly ownerId: string;
  /** Покупець, якого власник вручну закріплює в «Партнерах». */
  readonly lockedBuyerId: string;
};

async function seedDiscounts(db: ActorDb, vipId: string): Promise<void> {
  const groupId = randomUUID();
  await discountGroupsOps.insertIn(db, [
    {
      id: groupId,
      name: 'Акції магазину',
      operator: 'and',
      isActive: true,
      priority: 0,
    },
  ]);
  const [section] = await db
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.slug, BULK_SECTION_SLUG));
  if (!section)
    throw new Error(`[showcase] немає розділу ${BULK_SECTION_SLUG}`);
  const common = {
    groupId,
    discountType: 'percent',
    priceTypeId: null,
    priority: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
  } as const;
  const discounts = [
    {
      ...common,
      name: 'Від 3 шт −10%',
      description:
        'Кабелі та кріплення: від трьох одиниць у рядку — мінус 10%.',
      discountValue: 10,
      targets: [{ targetType: 'section', targetId: section.id }],
      conditions: [{ conditionType: 'min_quantity', operator: '>=', value: 3 }],
    },
    {
      ...common,
      name: 'VIP −5%',
      description: 'Додаткова знижка покупцям категорії VIP на весь каталог.',
      discountValue: 5,
      targets: [{ targetType: 'all', targetId: null }],
      conditions: [
        { conditionType: 'user_category', operator: 'in', value: [vipId] },
      ],
    },
  ];
  for (const discount of discounts)
    await saveDiscount(
      db,
      saveDiscountInput.parse({ id: randomUUID(), ...discount }),
    );
}

export async function seedLoyalty(
  db: ActorDb,
  input: LoyaltyInput,
): Promise<void> {
  const vipId = randomUUID();
  const partnerId = randomUUID();
  await userCategoriesOps.insertIn(db, [
    {
      id: vipId,
      name: 'VIP',
      code: 'vip',
      description: 'Постійні покупці',
      priceTypeId: input.wholesaleId,
    },
    {
      id: partnerId,
      name: 'Партнери',
      code: 'partner',
      description: 'Монтажники за угодою',
      priceTypeId: input.wholesaleId,
    },
  ]);
  await categoryRulesOps.insertIn(db, [
    {
      id: randomUUID(),
      name: 'Постійний покупець → VIP',
      description: `Від ${VIP_ORDERS_THRESHOLD} нескасованих замовлень.`,
      fromCategoryId: null,
      toCategoryId: vipId,
      conditions: {
        type: 'all',
        rules: [
          {
            field: 'orders_count',
            operator: '>=',
            value: String(VIP_ORDERS_THRESHOLD),
          },
        ],
      },
      isActive: true,
      priority: 10,
    },
  ]);
  await seedDiscounts(db, vipId);
  await assignCustomerCategory(
    db,
    assignCustomerCategoryInput.parse({
      userId: input.lockedBuyerId,
      categoryId: partnerId,
      reason: 'Партнерська угода',
      locked: true,
    }),
    { kind: 'admin', userId: input.ownerId },
  );
}
