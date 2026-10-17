import { createServerFn } from '@tanstack/react-start';
import {
  optionalSessionUserId,
  placeOrderFor,
  resolveTextLocale,
} from 'simplycms/storefront/loaders';
import { checkoutRequestSchema } from './checkout-input';

/**
 * Оформлення замовлення — тонка RPC-обгортка над `placeOrderFor`
 * (server-only дерево). Ідентичність — лише з серверної сесії.
 */
export const placeOrder = createServerFn({ method: 'POST' })
  .validator(checkoutRequestSchema)
  .handler(async ({ data: { locale, ...input } }) =>
    placeOrderFor(
      input,
      await optionalSessionUserId(),
      await resolveTextLocale(locale),
    ),
  );
