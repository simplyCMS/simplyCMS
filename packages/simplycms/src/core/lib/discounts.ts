import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import type { DiscountGroup } from 'simplycms/contracts';
import {
  loadDefaultPriceTypeId,
  loadDefaultUserCategoryId,
  loadDiscountGroups,
  loadUserCategoryId,
  loadUserPriceTypeId,
  withCustomerDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

/** Хто питає ціну — вхід рушія знижок, який не залежить від кошика. */
export interface DiscountActor {
  userId: string | null;
  userCategoryId: string | null;
  isLoggedIn: boolean;
}

/** Правила знижок і актор — усе, що потрібно домену, крім самої позиції. */
export interface DiscountEnvironment {
  groups: DiscountGroup[];
  actor: DiscountActor;
}

/**
 * Правила знижок і категорія покупця — ОДИН серверний виклик.
 *
 * 🔴 Категорія НЕ приймається параметром і ніколи ним не стане: клієнт, який
 * називає свою категорію, називає й свою знижку. Залогінений покупець читає
 * її під власним актором (`profiles_select_own`), анонім дістає категорію за
 * замовчуванням — і жодного шляху, яким браузер міг би підмінити одну на іншу.
 *
 * 🔴 Рахує ціну домен, не цей виклик: сервер віддає ПРАВИЛА. Кількість і сума
 * кошика живуть у клієнті, тож обчислення тут дало б знижку від неповного
 * контексту (див. `simplycms/storefront/loaders/discounts`).
 *
 * 🔴 Модуль містить РІВНО один експорт-serverFn і жодної звичайної функції:
 * трансформація Start вирізає тіло хендлера разом із серверними імпортами, а
 * живий не-serverFn експорт тримав би їх — і затягнув би пул Postgres у
 * клієнтський бандл (той самий урок, що в `./price-type`).
 */
export const getDiscountEnvironment = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DiscountEnvironment> => {
    const subject = await readSessionSubject(getRequest().headers);

    const fallback = await withStorefrontDb(async (db) => ({
      priceTypeId: await loadDefaultPriceTypeId(db),
      categoryId: await loadDefaultUserCategoryId(db),
    }));

    const personal = subject
      ? await withCustomerDb(subject.userId, async (db) => ({
          priceTypeId: await loadUserPriceTypeId(db, subject.userId),
          categoryId: await loadUserCategoryId(db, subject.userId),
        }))
      : null;

    const priceTypeId = personal?.priceTypeId ?? fallback.priceTypeId;
    const groups = priceTypeId
      ? await withStorefrontDb((db) => loadDiscountGroups(db, priceTypeId))
      : [];

    return {
      groups,
      actor: {
        userId: subject?.userId ?? null,
        // Категорія за замовчуванням лишається запасним варіантом і для
        // залогіненого: профіль без категорії інакше випав би з роздрібної
        // акції, у яку гість потрапляє.
        userCategoryId: personal?.categoryId ?? fallback.categoryId,
        isLoggedIn: subject !== null,
      },
    };
  },
);
