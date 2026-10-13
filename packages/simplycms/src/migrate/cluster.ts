import pg from 'pg';

/** Бази, які не рахуються «чужими магазинами»: службова й шаблони. */
const SERVICE_DATABASES = ['postgres', 'template0', 'template1'];

/**
 * `has_database_privilege` по ролі `app_runtime`, а не по `current_user`:
 * вимога платформи формулюється про кластерні ролі магазину, а не про того,
 * хто підключився. Стоковий `PUBLIC CONNECT` робить кожну сторонню базу
 * «доступною» — так і треба, спільний кластер порушує вимогу.
 */
const FOREIGN_DATABASES_SQL = `select datname from pg_database
  where datallowconn and not datistemplate
    and datname <> current_database()
    and datname <> all ($1::text[])
    and has_database_privilege('app_runtime', datname, 'CONNECT')
  order by datname`;

/**
 * Інші бази кластера, до яких має доступ роль `app_runtime`.
 *
 * Ролі `app_runtime`/`app_admin` кластерні: два магазини в одному кластері
 * ділять їх (синк пароля одного ламає інший, через `SET LOCAL ROLE app_admin`
 * видно чужу базу). Журнал чужої бази прочитати можна лише маючи `CONNECT`,
 * тож критерій «є журнал» є підмножиною «є `CONNECT`» — окремого проходу по
 * базах не потрібно, а імена чужих таблиць і даних не читаються взагалі.
 * Читання — read-only транзакція з рантайм-підключення, облікових даних
 * чужих баз не торкається.
 *
 * @returns імена баз; порожній масив — кластер виділений магазину.
 */
export async function findForeignDatabases(
  runtimeConnectionString: string,
  options: { timeoutMs?: number } = {},
): Promise<string[]> {
  const { timeoutMs } = options;
  const client = new pg.Client({
    connectionString: runtimeConnectionString,
    ...(timeoutMs
      ? { connectionTimeoutMillis: timeoutMs, statement_timeout: timeoutMs }
      : {}),
  });
  await client.connect();
  try {
    await client.query('begin read only');
    const { rows } = await client.query<{ datname: string }>(
      FOREIGN_DATABASES_SQL,
      [SERVICE_DATABASES],
    );
    await client.query('commit');
    return rows.map((row) => row.datname);
  } finally {
    await client.end();
  }
}
