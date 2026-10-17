import { refreshProductTexts } from 'simplycms/catalog-projection';
import type { ActorDb } from 'simplycms/db';
import type { TranslationWritePlan } from 'simplycms/domain/translations';

/**
 * Оновлення проєкції тексту після плану запису перекладів (І23). Зміна джерела
 * (основна мова) змінює fallback і `is_translated` УСІХ мов товару, тож тоді
 * перераховуємо всі; інакше — лише мови, які план справді торкнувся.
 */
export async function refreshAfterPlan(
  db: ActorDb,
  productId: string,
  plan: TranslationWritePlan,
  primary: string,
): Promise<void> {
  if (plan.upserts.length === 0) return;
  const touched = plan.upserts.map((u) => u.locale);
  await refreshProductTexts(
    db,
    [productId],
    touched.includes(primary) ? undefined : touched,
  );
}
