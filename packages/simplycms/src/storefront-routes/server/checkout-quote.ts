import { createServerFn } from '@tanstack/react-start';
import {
  optionalSessionUserId,
  quoteCheckoutFor,
} from 'simplycms/storefront/loaders';
import { checkoutInputSchema } from './checkout-input';

/**
 * Квота чекауту — тонка RPC-обгортка над `quoteCheckoutFor` (розділ M
 * рішень архітектора). Той самий вхід і той самий валідатор, що й
 * `placeOrder`: контактні поля квота не читає, але окрема схема була б
 * другою копією того, що вже описує `PlaceOrderInput`.
 */
export const quoteCheckout = createServerFn({ method: 'POST' })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }) =>
    quoteCheckoutFor(data, await optionalSessionUserId()),
  );
