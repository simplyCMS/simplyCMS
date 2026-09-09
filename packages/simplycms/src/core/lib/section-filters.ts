import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadSectionFilters,
  withStorefrontDb,
  type SectionFilters,
} from 'simplycms/storefront/loaders';

/**
 * Характеристики й опції панелі фільтрів розділу.
 *
 * 🔴 Живе в `core/lib`, а не поруч із рештою serverFn-ів вітрини
 * (`storefront-routes/server`), суто через напрямок шарів: споживач —
 * `catalog-ui` (T4), а `storefront-routes` — T5. Тір-зона ПК3 забороняє
 * імпорт угору, і правильна відповідь тут — опустити ФУНКЦІЮ до спільного
 * шару, а не послабити зону.
 *
 * 🔴 Модуль містить рівно один експорт-serverFn і жодної звичайної функції —
 * причина та сама, що в `./price-type`.
 */
export const getSectionFilters = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sectionId: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<SectionFilters> => {
    const { sectionId } = input as { sectionId: string };
    return withStorefrontDb((db) => loadSectionFilters(db, sectionId));
  });
