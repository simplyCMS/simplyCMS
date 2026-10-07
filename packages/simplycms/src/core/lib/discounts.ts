import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import type { DiscountEnvironment } from 'simplycms/contracts';
import { discountEnvironmentFor } from 'simplycms/storefront/loaders';

/**
 * Середовище цін вітрини — ліс знижок, актор, тип ціни й серверний `now`
 * ОДНІЄЮ транзакцією (Е6в-10, `storefront/loaders/discount-environment.ts`).
 *
 * 🔴 Актор НЕ приймається параметром і ніколи ним не стане: клієнт, який
 * називає свою категорію, називає й свою знижку. `userId` у клієнтському
 * ключі запиту — лише сегмент кешу; тут його бере серверна сесія.
 *
 * 🔴 Рахує ціну домен, не цей виклик: сервер віддає ПРАВИЛА й `now`, картка
 * рахує `priceForCard` на цьому `now`, а кошик — серверна квота.
 *
 * 🔴 Модуль містить РІВНО один експорт-serverFn і жодної звичайної функції:
 * трансформація Start вирізає тіло хендлера разом із серверними імпортами, а
 * живий не-serverFn експорт тримав би їх — і затягнув би пул Postgres у
 * клієнтський бандл (той самий урок, що в `storefront/loaders/is-admin`).
 */
export const getDiscountEnvironment = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DiscountEnvironment> => {
    const subject = await readSessionSubject(getRequest().headers);
    return discountEnvironmentFor(subject?.userId ?? null);
  },
);
