/**
 * 🔴 ЄДИНІ СИРІ ЗАПИСИ СІДУ (С-3, С-11). Усе інше наповнення йде через ядра
 * й операції застосунку; тут — лише два кроки, для яких продакшн-поверхні
 * свідомо немає. Обидва — під `withActor({ role: 'app_admin' })` викликача,
 * з явним переліком колонок: перейменування колонки ловить гейт С-8(г), а не
 * тихий no-op.
 *
 * 1. Схвалення відгуків (С-11): `insertProductReview` пише лише `pending`, а
 *    серверної операції модерації ще немає. Коли Е6д її спроєктує, крок
 *    переїде на ядро (борг у роадмапі).
 * 2. Зсув часу (С-3): продакшн-API заради сіду не отримує параметра `now`.
 *    Замовлення зсуваються на свій день-зсув із PRNG (0–29) разом із
 *    префіксом `YYMMDD` номера (UTC, як `generateOrderNumber`), історія
 *    категорій — на зсув замовлення, після якого вона зʼявилась (ручне
 *    закріплення до першого замовлення — на `BEFORE_FIRST_ORDER_DAYS`),
 *    реєстрація користувачів — ще раніше (`REGISTRATION_MIN_DAYS`+): інакше
 *    картка покупця показує замовлення, старші за саму реєстрацію.
 */
import { sql } from 'drizzle-orm';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';

/** Зсув ручних переведень, старших за будь-яке замовлення сіду (0–29). */
export const BEFORE_FIRST_ORDER_DAYS = 30;

/** Найсвіжіша реєстрація — раніше за будь-яку подію сіду. */
export const REGISTRATION_MIN_DAYS = BEFORE_FIRST_ORDER_DAYS + 1;

/** День-зсув одного рядка: замовлення чи користувача. */
export type DayShift = { readonly id: string; readonly days: number };

/** Усі відгуки сіду → `approved`. Повертає кількість схвалених. */
export async function approveReviews(db: ActorDb): Promise<number> {
  const result = await db.execute(sql`
    update public.product_reviews
       set status = 'approved', updated_at = now()
     where status = 'pending'
  `);
  return result.rowCount ?? 0;
}

/**
 * Зсуває дати замовлень, історії категорій і реєстрації у минуле.
 *
 * 🔴 Історія — ПЕРШОЮ: «замовлення, після якого зʼявився рядок» шукається за
 * ще не зсунутими `orders.created_at` (оформлення йшло по черзі, тож час
 * рядка історії завжди пізніший за своє замовлення).
 */
export async function shiftTime(
  db: ActorDb,
  shifts: readonly DayShift[],
  registrations: readonly DayShift[],
): Promise<void> {
  const payload = JSON.stringify(shifts);
  await db.execute(sql`
    with shift as (
      select * from jsonb_to_recordset(${payload}::jsonb) as s(id uuid, days int)
    ),
    target as (
      select h.id,
             coalesce((
               select s.days
                 from public.orders o
                 join shift s on s.id = o.id
                where o.user_id = h.user_id and o.created_at <= h.created_at
                order by o.created_at desc
                limit 1
             ), ${BEFORE_FIRST_ORDER_DAYS}) as days
        from public.user_category_history h
    )
    update public.user_category_history h
       set created_at = h.created_at - make_interval(days => t.days)
      from target t
     where t.id = h.id
  `);
  const orders = await db.execute(sql`
    update public.orders o
       set created_at = o.created_at - make_interval(days => s.days),
           updated_at = o.updated_at - make_interval(days => s.days),
           order_number = to_char(
             (o.created_at - make_interval(days => s.days)) at time zone 'UTC',
             'YYMMDD'
           ) || substr(o.order_number, 7)
      from jsonb_to_recordset(${payload}::jsonb) as s(id uuid, days int)
     where o.id = s.id
  `);
  if (orders.rowCount !== shifts.length) {
    throw new Error(
      `[showcase] зсув часу: оновлено ${orders.rowCount} замовлень із ${shifts.length}`,
    );
  }
  await shiftRegistrations(db, registrations);
}

/** Реєстрація: `users.created_at/updated_at` — з перевіркою кількості рядків. */
async function shiftRegistrations(
  db: ActorDb,
  shifts: readonly DayShift[],
): Promise<void> {
  const result = await db.execute(sql`
    update public.users u
       set created_at = u.created_at - make_interval(days => s.days),
           updated_at = u.updated_at - make_interval(days => s.days)
      from jsonb_to_recordset(${JSON.stringify(shifts)}::jsonb) as s(id uuid, days int)
     where u.id = s.id
  `);
  if (result.rowCount !== shifts.length) {
    throw new Error(
      `[showcase] зсув часу: оновлено ${result.rowCount} користувачів із ${shifts.length}`,
    );
  }
}
