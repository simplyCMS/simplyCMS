import { inArray } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import type {
  CheckoutItemInput,
  PlaceOrderRejection,
} from 'simplycms/contracts';
import { resolveDiscount } from 'simplycms/domain/discounts';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';
import type { ActorDb } from './db';
import { loadDefaultUserCategoryId, loadUserCategoryId } from './categories';
import { loadDiscountGroups } from './discounts';
import type { NewOrderItem } from './entities/new-order';
import type { JsonValue } from './entities/property';
import { loadDefaultPriceTypeId, loadPricesByProduct } from './pricing';
import { loadUserPriceTypeId } from './profile';

/**
 * Серверне ціноутворення позицій (К2-Е0, Е0-4).
 *
 * 🔴 Той самий ланцюг, що на картці товару, і те саме СЕРЕДОВИЩЕ знижок, що
 * будує `core/lib/discounts.ts::getDiscountEnvironment`: тип ціни і категорія
 * — персональні, з відкатом на ДЕФОЛТНІ (гість і покупець без категорії
 * дістають категорію за замовчуванням, не `null`); групи знижок читаються за
 * ефективним типом ціни (`loadDiscountGroups(db, priceTypeId)`). Інакше
 * чекаут рахував би інші знижки, ніж каталог (B2 аудиту r1). Кошик несе лише
 * id і кількість — назва, ціна і статус беруться з БД у цій же транзакції.
 *
 * 🔴 `cartTotal` тут — реальна сума базових цін усього запиту; картка товару
 * передає `0` (`product-detail/pricing.ts`), бо кошика не знає. Знижки з
 * умовою на суму кошика тому законно зʼявляються лише в чекауті — істина
 * про ціну позиції замовлення саме тут.
 */
export async function priceCheckoutItems(
  db: ActorDb,
  userId: string | null,
  items: CheckoutItemInput[],
): Promise<NewOrderItem[] | Extract<PlaceOrderRejection, 'not_purchasable'>> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const modIds = items
    .map((i) => i.modificationId)
    .filter((id): id is string => id !== null);

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      section_id: products.sectionId,
      stock_status: products.stockStatus,
      is_active: products.isActive,
    })
    .from(products)
    .where(inArray(products.id, productIds));
  const modRows = modIds.length
    ? await db
        .select({
          id: productModifications.id,
          product_id: productModifications.productId,
          name: productModifications.name,
          stock_status: productModifications.stockStatus,
        })
        .from(productModifications)
        .where(inArray(productModifications.id, modIds))
    : [];
  const prices = await loadPricesByProduct(db, productIds);
  const defaultPriceType = await loadDefaultPriceTypeId(db);
  const defaultCategory = await loadDefaultUserCategoryId(db);
  const userPriceType = userId ? await loadUserPriceTypeId(db, userId) : null;
  const userCategory = userId ? await loadUserCategoryId(db, userId) : null;
  const priceTypeId = userPriceType ?? defaultPriceType;
  const userCategoryId = userCategory ?? defaultCategory;
  const groups = priceTypeId ? await loadDiscountGroups(db, priceTypeId) : [];

  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  const byMod = new Map(modRows.map((m) => [m.id, m]));
  const cartTotal = items.reduce((sum, item) => {
    const base =
      resolvePrice(
        prices[item.productId] ?? [],
        priceTypeId,
        defaultPriceType,
        item.modificationId,
      ).price ?? 0;
    return sum + base * item.quantity;
  }, 0);

  const result: NewOrderItem[] = [];
  for (const item of items) {
    const product = byProduct.get(item.productId);
    const mod = item.modificationId ? byMod.get(item.modificationId) : null;
    if (!product || !product.is_active) return 'not_purchasable';
    if (item.modificationId && (!mod || mod.product_id !== item.productId))
      return 'not_purchasable';
    if (!isPurchasable(mod ? mod.stock_status : product.stock_status))
      return 'not_purchasable';

    const { price: basePrice } = resolvePrice(
      prices[item.productId] ?? [],
      priceTypeId,
      defaultPriceType,
      item.modificationId,
    );
    if (basePrice === null) return 'not_purchasable';

    const discount = resolveDiscount(basePrice, groups, {
      userId,
      userCategoryId,
      quantity: item.quantity,
      cartTotal,
      productId: item.productId,
      modificationId: item.modificationId,
      sectionId: product.section_id,
      isLoggedIn: userId !== null,
      now: new Date(),
    });

    result.push({
      productId: item.productId,
      modificationId: item.modificationId,
      name: mod ? `${product.name} - ${mod.name}` : product.name,
      price: discount.finalPrice,
      quantity: item.quantity,
      basePrice: discount.totalDiscount > 0 ? basePrice : null,
      discountData:
        discount.totalDiscount > 0
          ? { applied: discount.appliedDiscounts as unknown as JsonValue }
          : null,
    });
  }
  return result;
}
