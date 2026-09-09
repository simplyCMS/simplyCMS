import { createServerFn } from '@tanstack/react-start';
import {
  loadShippingDirectory,
  withStorefrontDb,
  type ShippingDirectory,
} from 'simplycms/storefront/loaders';

export type { ShippingDirectory };

/**
 * Довідники доставки для форми чекауту — ОДИН серверний виклик.
 *
 * 🔴 До В2-К1а форма робила три окремі запити з браузера через PostgREST
 * (`shipping_methods`, `shipping_rates`, `pickup_points`), а зони не читала
 * взагалі. Без PostgREST це просто не працює: покупець не може завершити
 * замовлення, бо форму нічим заповнити. Тут усе приїжджає однією транзакцією.
 *
 * 🔴 Читання ПУБЛІЧНЕ — `withStorefrontDb` (роль `app_user`, без ідентичності):
 * довідник доставки однаковий для всіх, і давати йому актора покупця означало б
 * без потреби розширювати те, що бачить анонім. Видимість тримає фільтр
 * `is_active` у лоадері, а не політика.
 *
 * 🔴 Модуль містить РІВНО один експорт-serverFn і жодної звичайної функції:
 * трансформація Start вирізає тіло хендлера разом із серверними імпортами, а
 * живий не-serverFn експорт тримав би їх — і затягнув би пул Postgres у
 * клієнтський бандл (той самий урок, що в `./price-type`).
 *
 * 🔴 Живе в `core/lib`, а не в `storefront-routes/server`, суто через напрямок
 * шарів: споживач — `checkout-ui` (T4), а `storefront-routes` — T5.
 */
export const getShippingDirectory = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShippingDirectory> =>
    withStorefrontDb((db) => loadShippingDirectory(db)),
);
