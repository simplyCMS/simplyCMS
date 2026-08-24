import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import {
  loadDefaultPriceTypeId,
  loadUserPriceTypeId,
  withCustomerDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

/** Тип ціни за замовчуванням і персональний тип поточного покупця. */
export interface PriceTypeContext {
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
}

/**
 * Контекст цін покупця — ОДИН серверний виклик.
 *
 * 🔴 Персональний тип ціни (знижкова категорія) раніше читав браузер запитом
 * `profiles → user_categories` з `user_id` із клієнта: підставивши чужий id,
 * можна було дізнатись чужу категорію. Тут id бере серверна сесія й нізвідки
 * більше.
 *
 * 🔴 Модуль містить РІВНО один експорт-serverFn і жодної звичайної функції:
 * трансформація Start вирізає тіло хендлера разом із серверними імпортами,
 * а живий не-serverFn експорт тримав би їх — і затягнув би пул Postgres у
 * клієнтський бандл (той самий урок, що в `storefront-routes/server/is-admin`).
 */
export const getPriceTypeContext = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PriceTypeContext> => {
    const defaultPriceTypeId = await withStorefrontDb((db) =>
      loadDefaultPriceTypeId(db),
    );
    const subject = await readSessionSubject(getRequest().headers);
    if (!subject)
      return { priceTypeId: defaultPriceTypeId, defaultPriceTypeId };

    const personal = await withCustomerDb(subject.userId, (db) =>
      loadUserPriceTypeId(db, subject.userId),
    );

    return {
      priceTypeId: personal ?? defaultPriceTypeId,
      defaultPriceTypeId,
    };
  },
);
