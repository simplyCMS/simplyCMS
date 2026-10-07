import { createServerFn } from '@tanstack/react-start';
import type { CartQuote } from 'simplycms/contracts';
import {
  optionalSessionUserId,
  quoteCartFor,
} from 'simplycms/storefront/loaders';
import { quoteCartInputSchema } from './cart-lines';

/**
 * Квота кошика (Е6в-13) — тонка RPC-обгортка над `quoteCartFor`: ціни,
 * знижки й порогові підказки рядків кошика рахує сервер тим самим ядром, що
 * й чек. Кошик у браузері несе лише ідентичність і кількість.
 *
 * 🔴 Актор НЕ приймається параметром: категорію (а отже знижку) визначає
 * серверна сесія. `userId` у клієнтському ключі — лише сегмент кешу.
 *
 * 🔴 `POST`, бо вхід — список позицій (до `MAX_CART_LINES`), а не параметр
 * адреси; валідатор — та сама схема позицій, що й в оформлення.
 *
 * 🔴 Модуль містить РІВНО один експорт-serverFn і жодної звичайної функції:
 * трансформація Start вирізає тіло хендлера разом із серверними імпортами, а
 * живий не-serverFn експорт тримав би їх у клієнтському бандлі.
 */
export const quoteCart = createServerFn({ method: 'POST' })
  .validator(quoteCartInputSchema)
  .handler(async ({ data }): Promise<CartQuote> =>
    quoteCartFor(data.items, await optionalSessionUserId()),
  );
