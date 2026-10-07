import type { ActorDb } from 'simplycms/db';
import {
  loadCategoryPriceTypeId,
  loadDefaultUserCategoryId,
} from './categories';
import { loadDefaultPriceTypeId } from './pricing';

/** Пара типів для `resolvePrice`: ефективний і глобальний дефолтний (відкат). */
export interface PriceTypes {
  /** Тип категорії; без типу в категорії — глобальний дефолтний. */
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
}

/**
 * ЄДИНЕ правило типу ціни (F5/F5b фінального рев'ю К3-Е6в): тип ЕФЕКТИВНОЇ
 * категорії, а якщо в ній типу немає (чи категорії немає) — глобальний
 * дефолтний. Кличуть і `loadPricingContext` (картка, кошик, чек,
 * діагностика), і SSR-лоадери списків (`loadGuestPriceTypes`): друга копія
 * правила вже раз розвела серверний HTML і ціну після гідрації.
 */
export async function resolvePriceTypes(
  db: ActorDb,
  categoryId: string | null,
): Promise<PriceTypes> {
  const defaultPriceTypeId = await loadDefaultPriceTypeId(db);
  const categoryType = categoryId
    ? await loadCategoryPriceTypeId(db, categoryId)
    : null;
  return {
    priceTypeId: categoryType ?? defaultPriceTypeId,
    defaultPriceTypeId,
  };
}

/**
 * Типи ціни ГОСТЯ — дефолтна категорія (Е6в-19). Для SSR: серверний HTML
 * гостьовий (персональний тип і знижки до гідрації не рахуються — К3-Е6в-1),
 * але база в ньому та сама, що гість побачить після гідрації.
 */
export async function loadGuestPriceTypes(db: ActorDb): Promise<PriceTypes> {
  return resolvePriceTypes(db, await loadDefaultUserCategoryId(db));
}
