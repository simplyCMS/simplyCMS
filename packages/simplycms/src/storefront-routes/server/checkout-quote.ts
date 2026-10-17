import { createServerFn } from '@tanstack/react-start';
import {
  optionalSessionUserId,
  quoteCheckoutFor,
  resolveTextLocale,
} from 'simplycms/storefront/loaders';
import { checkoutRequestSchema } from './checkout-input';

/**
 * Квота чекауту — тонка RPC-обгортка над `quoteCheckoutFor` (розділ M
 * рішень архітектора). Той самий вхід і той самий валідатор, що й
 * `placeOrder`: контактні поля квота не читає, але окрема схема була б
 * другою копією того, що вже описує `PlaceOrderInput`.
 */
export const quoteCheckout = createServerFn({ method: 'POST' })
  .validator(checkoutRequestSchema)
  .handler(async ({ data: { locale, ...input } }) =>
    quoteCheckoutFor(
      input,
      await optionalSessionUserId(),
      await resolveTextLocale(locale),
    ),
  );
