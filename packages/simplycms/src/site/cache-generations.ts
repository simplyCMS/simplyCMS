import { eq, sql } from 'drizzle-orm';
import { withActor, type ActorDb } from 'simplycms/db';
import { cacheGenerations } from 'simplycms/schema';
import { getRequestContext } from './request-context';

/**
 * Ключі поколінь кешів читання (Д6). Рядки фіксовані й засіяні в
 * `0003_seed.sql`: новий ключ — це правка сіду разом із цією константою.
 */
export const CACHE_KEYS = {
  storeProfile: 'store-profile',
  activeTheme: 'active-theme',
  languages: 'languages',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

/**
 * Збільшити покоління ключа У ТРАНЗАКЦІЇ мутації (Д6): якщо транзакція
 * відкотиться, покоління не зросте, а якщо закомітиться — зростає атомарно
 * разом із даними. Скидання після COMMIT, як було з процесним `invalidate()`,
 * губило б зміну при падінні процесу між COMMIT і скиданням.
 *
 * 🔴 Незасіяний ключ — дефект БД, а не помилка власника, тому звичайний
 * `Error` (прод маскує його з посиланням, у логах — діагностика), а не клас
 * `domain-errors`: ті серіалізуються клієнту як «зрозуміла» відмова. Тиха
 * відсутність оновлення залишила б кеші реплік навічно застарілими.
 */
export async function bumpCacheGeneration(
  db: ActorDb,
  key: CacheKey,
): Promise<void> {
  const updated = await db
    .update(cacheGenerations)
    .set({ generation: sql`${cacheGenerations.generation} + 1` })
    .where(eq(cacheGenerations.key, key))
    .returning({ key: cacheGenerations.key });
  if (updated.length === 0)
    throw new Error(
      `[simplycms/site] ключ покоління кешу «${key}» не засіяно в cache_generations`,
    );
}

/** Один запит усіх поколінь. Читає вітринна роль: гранти — `app_user`. */
function loadGenerations(): Promise<ReadonlyMap<string, bigint>> {
  return withActor({ role: 'app_user' }, async (db) => {
    const rows = await db
      .select({
        key: cacheGenerations.key,
        generation: cacheGenerations.generation,
      })
      .from(cacheGenerations);
    return new Map(rows.map((r) => [r.key, r.generation] as const));
  });
}

/**
 * Покоління всіх кешів. У контексті запиту — ОДИН `select` на HTTP-запит
 * (проміс мемоізується в контексті, тож паралельні `get` трьох кешів діляться
 * ним); поза запитом (CLI, фонові задачі) контексту немає, тож запит на кожен
 * виклик.
 */
export function readGenerations(): Promise<ReadonlyMap<string, bigint>> {
  const ctx = getRequestContext();
  if (!ctx) return loadGenerations();
  // Відмову `select` теж мемоізуємо: межа — один HTTP-запит, тож усі `get` цього
  // запиту відмовляють разом, а наступний запит дістає свіжу спробу.
  return (ctx.generations ??= loadGenerations());
}
