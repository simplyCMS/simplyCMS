import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { Banner } from 'simplycms/contracts';
import { loadBanners, withStorefrontDb } from 'simplycms/storefront/loaders';

/**
 * Банери одного місця розміщення.
 *
 * 🔴 Живе в `core/lib`, а не поруч із рештою serverFn-ів вітрини
 * (`storefront-routes/server`), суто через напрямок шарів: споживач — хук у
 * `core` (T5), а `storefront-routes` — теж T5, і тір-зона ПК3 забороняє
 * імпорт убік/угору. Правильна відповідь — опустити ФУНКЦІЮ до спільного
 * шару, а не послабити зону.
 *
 * 🔴 Модуль містить рівно один експорт-serverFn і жодної звичайної функції —
 * причина та сама, що в `./price-type`.
 */
export const getBanners = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      placement: z.string().min(1),
      sectionId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }): Promise<Banner[]> => {
    const query = data as { placement: string; sectionId?: string | null };
    return withStorefrontDb((db) => loadBanners(db, query));
  });
