import type {
  CartQuote,
  CartQuoteLine,
  CheckoutItemInput,
} from 'simplycms/contracts';
import { loadPricingContext, priceCart } from 'simplycms/commerce';
import type { TextLocale } from 'simplycms/domain/translations';
import { toCents } from 'simplycms/domain/pricing';
import { withCustomerDb, withStorefrontDb, type ActorDb } from './db';
import { lineKey, loadLineImages } from './line-images';

const EMPTY_QUOTE: CartQuote = { lines: [], subtotal: 0 };

/**
 * Квота кошика (Е6в-13) — ціни, знижки й підказки рядків тим самим ядром
 * (`loadPricingContext` + `priceCart`), що рахує чек: картка, кошик і чек
 * розійтися не можуть за побудовою.
 *
 * 🔴 `text` — мова назв рядків (мова сторінки, звірена з опублікованими:
 * `resolveTextLocale`); на ціни й знижки не впливає.
 *
 * 🔴 `userId` — лише з серверної сесії (`core/lib/cart-quote.ts`): клієнт,
 * який називає себе, називає й свою категорію, а отже знижку.
 *
 * 🔴 Недоступна позиція — рядок `available: false`, а не відмова всієї
 * квоти: покупець бачить, що зникло, і решта кошика рахується далі.
 *
 * 🔴 У браузер іде лише назва й сума застосованої знижки: id, тип і розклад
 * відхилених — пояснення для адмінки (діагностика ціни), не для вітрини.
 */
export async function quoteCartFor(
  items: CheckoutItemInput[],
  userId: string | null,
  text: TextLocale,
): Promise<CartQuote> {
  if (items.length === 0) return EMPTY_QUOTE;

  // Мініатюри — у тій самій транзакції, мовою назв (Task 17б): кошик на `/en` показує фото en.
  const load = async (db: ActorDb) => {
    const priced = await priceCart(
      db,
      await loadPricingContext(db, userId),
      items,
      text,
    );
    const images = await loadLineImages(
      db,
      priced.lines.filter((l) => l.available),
      text,
    );
    return { lines: priced.lines, images };
  };
  const { lines, images } = userId
    ? await withCustomerDb(userId, load)
    : await withStorefrontDb(load);

  // Сума — цілими центами, як і `cartTotal` ядра: хвіст float не має давати
  // копійку розбіжності з чеком.
  let cents = 0;
  const quoted = lines.map((line): CartQuoteLine => {
    if (!line.available) return line;
    cents += toCents(line.price) * line.quantity;
    return {
      available: true,
      productId: line.productId,
      modificationId: line.modificationId,
      quantity: line.quantity,
      name: line.name,
      productName: line.productName,
      modificationName: line.modificationName,
      productNameLang: line.productNameLang,
      modificationNameLang: line.modificationNameLang,
      image: images.get(lineKey(line)) ?? null,
      basePrice: line.basePrice,
      price: line.price,
      applied: line.applied.map(({ name, calculatedAmount }) => ({
        name,
        calculatedAmount,
      })),
      hints: line.hints,
    };
  });
  return { lines: quoted, subtotal: cents / 100 };
}
