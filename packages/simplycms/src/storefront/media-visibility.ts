import { eq } from 'drizzle-orm';
import { can, readSessionSubject, type SessionSubject } from 'simplycms/auth';
import { PERSONAL_MEDIA_ENTITY_TYPES } from 'simplycms/domain/media';
import { media, productReviews } from 'simplycms/schema';
import type { MediaServeVerdict } from 'simplycms/storage';
import { withCustomerDb, withStorefrontDb, type ActorDb } from './loaders/db';

/**
 * Чи бачить глядач сутність-власника файлу (Е6д-21). `subject` — `null` для
 * гостя без сесії.
 */
export type MediaVisibilityResolver = (
  entityId: string,
  subject: SessionSubject | null,
) => Promise<boolean>;

const reviewExists = (db: ActorDb, id: string) =>
  db
    .select({ id: productReviews.id })
    .from(productReviews)
    .where(eq(productReviews.id, id))
    .limit(1);

/**
 * Відгук: видимість ДЕЛЕГОВАНА RLS (`product_reviews_select_approved_or_own`) —
 * питаємо «чи бачу я рядок», а не дублюємо предикат у коді. Адмін-модератор
 * бачить усе. Гість іде через `withStorefrontDb` (той самий `app_user`, без
 * `app.user_id`), покупець — через `withCustomerDb` зі своїм id із сесії.
 */
const reviewVisible: MediaVisibilityResolver = async (entityId, subject) => {
  if (subject && can(subject, 'review.moderate')) return true;
  const rows = subject
    ? await withCustomerDb(subject.userId, (db) => reviewExists(db, entityId))
    : await withStorefrontDb((db) => reviewExists(db, entityId));
  return rows.length > 0;
};

/**
 * Резолвери за `entity_type`. 🔴 ЯВНА константа, а не реєстр, що наповнюється
 * побічним ефектом імпорту: тип без резолвера видимий, якщо рядок `media`
 * є, і мовчки «забутий» резолвер був би дірою. Нова сутність з обмеженою
 * видимістю додається сюди.
 */
export const MEDIA_VISIBILITY: Partial<
  Record<string, MediaVisibilityResolver>
> = { review: reviewVisible };

const isPersonal = (entityType: string): boolean =>
  (PERSONAL_MEDIA_ENTITY_TYPES as readonly string[]).includes(entityType);

/** `lookup` для `serveMedia`: рядок `media` за ключем + видимість власника. */
export async function lookupMediaForRequest(
  key: string,
  request: Request,
): Promise<MediaServeVerdict> {
  const [row] = await withStorefrontDb((db) =>
    db
      .select({ entityType: media.entityType, entityId: media.entityId })
      .from(media)
      .where(eq(media.storageKey, key))
      .limit(1),
  );
  if (!row) return 'missing';

  const resolver = MEDIA_VISIBILITY[row.entityType];
  if (resolver) {
    // Сесію читаємо лише там, де вона потрібна: банери й товари — публічні.
    const subject = await readSessionSubject(request.headers);
    if (!(await resolver(row.entityId, subject))) return 'hidden';
  }
  return { personal: isPersonal(row.entityType) };
}
