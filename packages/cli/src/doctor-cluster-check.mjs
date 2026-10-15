// Онлайн-перевірка вимоги платформи: кожному магазину — власний екземпляр
// Postgres. Ролі `app_runtime`/`app_admin` кластерні, тож чужа база в кластері
// означає спільні ролі. Текст називає бази, але не облікові дані.
import { redactUrls } from './redact-urls.mjs';

const ID = 'shared-cluster';
const TITLE = 'Окремий екземпляр Postgres';

/** Рядок-пропуск (немає DATABASE_URL / pg / БД недоступна). */
export const clusterSkip = (details) => ({
  id: ID,
  title: TITLE,
  status: 'skip',
  details,
});

/**
 * @param {string} url DATABASE_URL
 * @param {{ findForeignDatabases: Function }} core ядро магазину (`simplycms/migrate`)
 * @param {number} timeoutMs бюджет на з'єднання й запит
 */
export async function clusterCheck(url, core, timeoutMs) {
  try {
    const foreign = await core.findForeignDatabases(url, { timeoutMs });
    if (foreign.length === 0) return { id: ID, title: TITLE, status: 'ok' };
    return {
      id: ID,
      title: TITLE,
      status: 'warn',
      details: `у кластері є інші бази (${foreign.join(', ')}) — магазину потрібен окремий екземпляр Postgres; спільний кластер ділить ролі app_runtime/app_admin між магазинами`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: ID,
      title: TITLE,
      status: 'error',
      details: redactUrls(message),
    };
  }
}
