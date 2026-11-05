import type { ContentLocale } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';

// Контекст команди дочірніх колекцій агрегата товару (М1, Task 12). Кроки й розбір
// мов — спільні, `translatable/steps.ts`.

/** Що знають усі кроки: транзакція, товар, основна мова, відомі мови. */
export interface ChildCtx {
  readonly db: ActorDb;
  readonly productId: string;
  readonly primary: ContentLocale;
  readonly locales: ReadonlySet<string>;
  /** Модифікації товару ПІСЛЯ команди: наявні + нові − видалені. */
  readonly modificationIds: ReadonlySet<string>;
}
