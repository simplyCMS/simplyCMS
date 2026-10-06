import { z } from 'zod';
import { PRICE_TYPE_CODE_RE } from 'simplycms/domain';
import {
  SHIPPING_PRICINGS,
  SHIPPING_PROVIDER,
  SHIPPING_PROVIDERS,
} from 'simplycms/contracts/shipping-providers';

/**
 * Значення форми способу доставки (Е6а-1, Task 6). Формат коду — спільна
 * константа T1 (`PRICE_TYPE_CODE_RE`), яку перевіряє й сервер. Режим
 * `provider` без `supportsQuote` відсікає і форма (опція disabled), і
 * refine тут, і сервер (Е6а-12) — три рівні для одного інваріанта.
 */
export const shippingMethodFormSchema = z
  .object({
    provider: z.enum(SHIPPING_PROVIDER),
    name: z.string().trim().min(1),
    code: z.string().trim().min(1).max(50).regex(PRICE_TYPE_CODE_RE),
    description: z.string(),
    pricing: z.enum(SHIPPING_PRICINGS),
    icon: z.string().trim(),
    sortOrder: z.coerce.number().int().min(0),
    isActive: z.boolean(),
  })
  .refine(
    (v) =>
      v.pricing !== 'provider' || SHIPPING_PROVIDERS[v.provider].supportsQuote,
    { path: ['pricing'] },
  );

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type ShippingMethodFormInput = z.input<typeof shippingMethodFormSchema>;
export type ShippingMethodFormValues = z.output<
  typeof shippingMethodFormSchema
>;
