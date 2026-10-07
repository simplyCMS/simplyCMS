import { asc, gt } from 'drizzle-orm';
import { profiles } from 'simplycms/schema';
import { applyCategoryRules } from 'simplycms/commerce';
import type { ActorDb } from 'simplycms/db';
import { runAdminTransactions } from '../run';

/** Розмір порції keyset-обходу профілів (Е6в-19). */
export const CATEGORY_RULES_BATCH = 100;

type ProfileRef = { id: string; userId: string };

/** Наступна порція профілів після `after` (keyset, без OFFSET). */
function profilePage(db: ActorDb, after: string | null): Promise<ProfileRef[]> {
  return db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles)
    .where(after === null ? undefined : gt(profiles.id, after))
    .orderBy(asc(profiles.id))
    .limit(CATEGORY_RULES_BATCH);
}

/**
 * «Запустити всі правила» (Е6в-19): keyset по `profiles.id` порціями по 100,
 * КОЖЕН покупець — у власній транзакції (`applyCategoryRules` бере його лок
 * першим запитом). Одна довга транзакція тримала б тисячі рядкових локів і
 * блокувала б оформлення замовлень на весь прогін.
 *
 * `checked` — усі переглянуті профілі (заблоковані вручну й збійні теж),
 * `changed` — ті, кого правило перевело, `failed` — ті, чия транзакція
 * впала. 🔴 Збій одного покупця ізольовано (рішення контролера): його
 * транзакція відкочується, помилка йде в `console.error`, обхід триває —
 * інакше один поганий профіль зупиняв би перерахунок усього магазину.
 * Грант перевіряється один раз на запуск.
 */
export const runCategoryRulesOp = async (): Promise<{
  checked: number;
  changed: number;
  failed: number;
}> =>
  runAdminTransactions('customer.manage', async (transaction) => {
    let checked = 0;
    let changed = 0;
    let failed = 0;
    let after: string | null = null;
    for (;;) {
      const cursor: string | null = after;
      const page: ProfileRef[] = await transaction((db) =>
        profilePage(db, cursor),
      );
      for (const profile of page) {
        checked += 1;
        try {
          const outcome = await transaction((db) =>
            applyCategoryRules(db, profile.userId),
          );
          if (outcome === 'changed') changed += 1;
        } catch (error) {
          failed += 1;
          console.error(
            `[simplycms/admin-server] category rules failed for customer ${profile.userId}:`,
            error,
          );
        }
      }
      if (page.length < CATEGORY_RULES_BATCH) break;
      after = page[page.length - 1]!.id;
    }
    return { checked, changed, failed };
  });
