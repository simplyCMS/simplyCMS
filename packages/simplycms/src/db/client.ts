import pg from 'pg';

/**
 * Пул зʼєднань до Postgres — server-only фабрика db-рантайму (Task 6, В2-К1а).
 *
 * 🔴 Модуль НЕ призначений для прямого вжитку: єдиний легальний споживач —
 * `./with-actor`. Голе зʼєднання відкриває обидва тихі режими відмови, які
 * весь дизайн B5″ і виключає: запит без `SET LOCAL ROLE` (fail-closed зникає,
 * якщо конектитись власником) і claims, виставлені поза транзакцією (течуть
 * на наступного клієнта пулу). Тому імпорт `simplycms/db/client` поза текою
 * `src/db/` — помилка лінту (зона в `eslint.config.mjs`, негативний контроль —
 * `tests/db-client-boundary.test.ts`), а в `exports`-мапі пакета цього
 * субшляху немає взагалі: магазин фізично не має до нього шляху.
 */

/** Джерело змінних оточення (той самий контракт, що в `supabase/keys`). */
export interface DbEnv {
  readonly DATABASE_URL?: string;
}

/**
 * Резолвить рядок підключення до Postgres.
 *
 * 🔴 Виділено окремою чистою функцією навмисно: так контракт env перевіряється
 * юнітом без БД, а фабрика нижче лишається тонкою.
 *
 * @throws Error якщо `DATABASE_URL` відсутній або порожній.
 */
export function resolveDatabaseUrl(env: DbEnv): string {
  // `||`, а не `??`: оголошена-але-порожня змінна в `.env` — це відсутній
  // ключ, інакше `DATABASE_URL=` мовчки дав би конект у нікуди.
  const url = env.DATABASE_URL || undefined;

  if (!url) {
    throw new Error(
      '[simplycms/db] Відсутня змінна оточення DATABASE_URL — серверний ' +
        'контур не має куди підключатися. Контракт серверного env — спека ' +
        'CLI v1 §7 (лише process.env, лише в рантаймі).',
    );
  }

  return url;
}

let pool: pg.Pool | undefined;

/**
 * Стеля очікування вільного/нового зʼєднання, мс.
 *
 * 🔴 Без неї недоступний host підвисає до СИСТЕМНОГО TCP-таймауту (десятки
 * секунд і більше), і `/api/health` замість своєчасного 503 просто не
 * відповідає. Для healthcheck деплою (Dokploy) це гірше за 503: чесна
 * «degraded» читається як стан БД, а мовчанка — як зависання застосунку.
 * Значення свідомо менше за типовий інтервал healthcheck.
 */
const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * Пул процесу (лінива синглтон-фабрика).
 *
 * Контракт серверного env (спека CLI v1, §7): `DATABASE_URL` читається ЛИШЕ з
 * `process.env` і ЛИШЕ тут, у рантаймі — не на модуль-рівні. Наслідок той
 * самий, що й у Supabase-фабрик: зміна рядка підключення = перезапуск
 * процесу, без перезбірки. Другий виклик віддає ВЖЕ створений пул, тож
 * підміна `DATABASE_URL` посеред життя процесу нічого не змінить — це не
 * недогляд, а та сама семантика «рестарт замість гарячої ротації».
 *
 * @throws Error у браузері (див. server-only гард нижче).
 */
export function getDbPool(): pg.Pool {
  // Server-only гард. `supabase/anon-client` покладався на те, що голий
  // `process.env` у браузері впаде сам; тут падіння було б глибоко в `pg`
  // і без діагнозу, тож причина називається явно.
  if (typeof window !== 'undefined') {
    throw new Error(
      '[simplycms/db] Пул Postgres — server-only: у сервер-first (B1) ' +
        'браузер до БД не ходить узагалі. Модуль потрапив у клієнтський ' +
        'бандл — шукай імпорт з клієнтського контуру.',
    );
  }

  pool ??= new pg.Pool({
    connectionString: resolveDatabaseUrl(process.env),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  return pool;
}

/**
 * Гасить пул процесу (graceful shutdown, teardown тестів).
 *
 * Ідемпотентна: другий виклик — no-op. Після неї наступний `getDbPool()`
 * створює пул наново — саме тому тести можуть перемикати `DATABASE_URL`.
 */
export async function closeDbPool(): Promise<void> {
  const current = pool;
  pool = undefined;
  await current?.end();
}
