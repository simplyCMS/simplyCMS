import { z } from 'zod';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from 'simplycms/contracts/cart-limits';

/**
 * Позиція кошика — ЛИШЕ ідентичність, кількість і підписи для показу.
 *
 * 🔴 Ціни тут немає (Е6в-13): ціну, знижку й суму рахує серверна квота
 * (`useCartQuote`). Ціна, запамʼятована при додаванні, не оновлювалась ні при
 * повторному додаванні, ні після перезавантаження — кошик брехав про суму.
 */
export interface CartItem {
  productId: string;
  modificationId: string | null;
  name: string;
  modificationName?: string;
  quantity: number;
  image?: string;
  sku?: string;
}

/**
 * Рядок сховища. localStorage — це ВВІД (старий формат, інша вкладка, ручна
 * правка), а не довірені дані. Правила ідентичності й кількості — ті самі,
 * що в серверній схемі позицій (`core/lib/cart-lines`): рядок, який кошик
 * прийняв, не має валити квоту чи оформлення. Невідомі поля (`price`,
 * `basePrice`, `discountData` старого формату) відкидаються.
 */
const storedLineSchema = z.object({
  productId: z.string().uuid(),
  modificationId: z.string().uuid().nullable(),
  name: z.string(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  modificationName: z.string().optional().catch(undefined),
  image: z.string().optional().catch(undefined),
  sku: z.string().optional().catch(undefined),
});

/** Ідентичність рядка кошика — пара товар/модифікація. */
export const sameLine = (
  a: Pick<CartItem, 'productId' | 'modificationId'>,
  b: Pick<CartItem, 'productId' | 'modificationId'>,
): boolean =>
  a.productId === b.productId && a.modificationId === b.modificationId;

/** Кількість у межах рядка: ціла, не більша за `MAX_LINE_QUANTITY`. */
export const clampQuantity = (quantity: number): number =>
  Math.min(MAX_LINE_QUANTITY, Math.floor(quantity));

/**
 * Скінченне число? `NaN`/`Infinity` (порожнє поле кількості, `Number('')`
 * теми) кошик не міняють: `Math.min(999, NaN)` — `NaN`, і рядок став би
 * невалідним для сервера й для самого сховища.
 */
export const isQuantity = (quantity: unknown): quantity is number =>
  typeof quantity === 'number' && Number.isFinite(quantity);

/**
 * Сховище → кошик: невалідні рядки відкинуто (без винятку), дублі пари
 * зведено в один рядок (кількість ≤ `MAX_LINE_QUANTITY`), довжина — до
 * `MAX_CART_LINES`. Серверні валідатори дублі відкидають, тож кошик їх не
 * тримає.
 */
export function normalizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const lines: CartItem[] = [];
  for (const row of raw) {
    const parsed = storedLineSchema.safeParse(row);
    if (!parsed.success) continue;
    const item = withoutUndefined(parsed.data);
    const index = lines.findIndex((l) => sameLine(l, item));
    if (index >= 0) {
      lines[index] = {
        ...lines[index],
        quantity: clampQuantity(lines[index].quantity + item.quantity),
      };
    } else if (lines.length < MAX_CART_LINES) {
      lines.push(item);
    }
  }
  return lines;
}

/**
 * Результат додавання (Е6в-13, ред.3): `limit_reached` — позицію додано не
 * повністю або не додано зовсім, бо кошик уперся в `MAX_CART_LINES` рядків
 * чи `MAX_LINE_QUANTITY` шт. Кнопка показує тост межі, а не «Додано».
 */
export type AddItemResult = 'added' | 'limit_reached';

/**
 * Додати позицію: наявна пара лише збільшує кількість (ціни в кошику немає —
 * суму перерахує квота), нова — новий рядок, якщо є місце.
 */
export function addLine(
  prev: readonly CartItem[],
  item: Omit<CartItem, 'quantity'> & { quantity?: number },
): { lines: readonly CartItem[]; result: AddItemResult } {
  const wanted = isQuantity(item.quantity)
    ? Math.max(1, Math.floor(item.quantity))
    : 1;
  const index = prev.findIndex((l) => sameLine(l, item));
  if (index < 0 && prev.length >= MAX_CART_LINES)
    return { lines: prev, result: 'limit_reached' };
  const current = index >= 0 ? prev[index].quantity : 0;
  const quantity = clampQuantity(current + wanted);
  const result = quantity < current + wanted ? 'limit_reached' : 'added';
  if (quantity === current) return { lines: prev, result };
  const lines = [...prev];
  if (index < 0) lines.push({ ...item, quantity });
  else lines[index] = { ...prev[index], quantity };
  return { lines, result };
}

/** Відсутні підписи — без ключа, а не `undefined`: рядок пишеться в JSON. */
function withoutUndefined(line: z.infer<typeof storedLineSchema>): CartItem {
  const item: CartItem = {
    productId: line.productId,
    modificationId: line.modificationId,
    name: line.name,
    quantity: line.quantity,
  };
  if (line.modificationName !== undefined)
    item.modificationName = line.modificationName;
  if (line.image !== undefined) item.image = line.image;
  if (line.sku !== undefined) item.sku = line.sku;
  return item;
}
