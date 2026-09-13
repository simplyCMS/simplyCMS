import { createServerFn } from '@tanstack/react-start';
import {
  optionalSessionUserId,
  placeOrderFor,
} from 'simplycms/storefront/loaders';
import { checkoutInputSchema } from './checkout-input';

/**
 * Оформлення замовлення — тонка RPC-обгортка над `placeOrderFor`
 * (server-only дерево). Ідентичність — лише з серверної сесії.
 */
export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }) =>
    placeOrderFor(data, await optionalSessionUserId()),
  );
