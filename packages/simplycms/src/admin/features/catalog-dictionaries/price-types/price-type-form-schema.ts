import { z } from 'zod';
import { PRICE_TYPE_CODE_RE } from 'simplycms/domain';

/**
 * Значення форми картки типу ціни (Е4, Task 6). Формат коду — спільна
 * константа T1 (`PRICE_TYPE_CODE_RE`), яку перевіряє й сервер (Е4-7).
 * `isDefault` у patch колекції НЕ йде: колонка readonly, дефолт ставить
 * лише `setDefaultPriceType`.
 */
export const priceTypeFormSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().regex(PRICE_TYPE_CODE_RE),
  sortOrder: z.coerce.number().int().min(0),
  isDefault: z.boolean(),
});

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type PriceTypeFormInput = z.input<typeof priceTypeFormSchema>;
export type PriceTypeFormValues = z.output<typeof priceTypeFormSchema>;
