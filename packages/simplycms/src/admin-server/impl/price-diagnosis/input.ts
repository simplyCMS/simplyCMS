import { z } from 'zod';
import { MAX_LINE_QUANTITY } from 'simplycms/contracts/cart-limits';

/**
 * Вхід діагностики ціни (Е6в, З-4). `userId: null` — гість (дефолтна
 * категорія й тип ціни); `otherCartTotal` — сума кошика ПОЗА цією позицією
 * (знижка «від суми» бачить увесь склад).
 */
export const diagnosePriceInput = z.object({
  userId: z.uuid().nullable(),
  productId: z.uuid(),
  modificationId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  otherCartTotal: z.number().min(0).finite(),
});
