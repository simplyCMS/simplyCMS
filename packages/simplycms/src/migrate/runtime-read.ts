import pg from 'pg';

/** Бюджет читання з рантайм-підключення (спільний для журналу й фактів магазину). */
export type RuntimeReadOptions = {
  /**
   * Мілісекунди і на з'єднання (`connectionTimeoutMillis`), і на запит
   * (`statement_timeout` сесії). Без нього читач чекає скільки завгодно:
   * для `doctor --online` і `status` недоступна БД не має підвішувати команду.
   */
  timeoutMs?: number;
};

/**
 * Єдиний спосіб читати БД магазину з `DATABASE_URL` (роль `app_runtime`) для CLI:
 * read-only транзакція під `SET LOCAL ROLE app_admin` (членство дає `0000_prelude`).
 * Прямих прав `app_runtime` на журнал і службові таблиці не має (fail-closed), тож
 * інакше читати нічим; писати з цього каналу неможливо за побудовою.
 */
export async function withRuntimeAdminRead<T>(
  runtimeConnectionString: string,
  { timeoutMs }: RuntimeReadOptions,
  read: (client: pg.ClientBase) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({
    connectionString: runtimeConnectionString,
    ...(timeoutMs
      ? { connectionTimeoutMillis: timeoutMs, statement_timeout: timeoutMs }
      : {}),
  });
  await client.connect();
  try {
    await client.query('begin read only');
    try {
      await client.query('set local role app_admin');
      const result = await read(client);
      await client.query('commit');
      return result;
    } catch (err) {
      // Мертве з'єднання не має підмінити першопричину помилкою rollback.
      await client.query('rollback').catch(() => {});
      throw err;
    }
  } finally {
    await client.end();
  }
}
