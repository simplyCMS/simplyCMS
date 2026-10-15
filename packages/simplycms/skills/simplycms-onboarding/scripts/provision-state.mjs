// Читання стану Dokploy і побудова плану для `dokploy.mjs provision`.
import { dbSecretsKind } from './provision-secrets.mjs';

const RETRIES = 5;
const RUNNING = ['done', 'running'];

/** Проєкт, БД, застосунок і домен за імʼям (імена — з `names`). */
export async function readState(call, names) {
  const project = (await call('project.all')).find(
    (p) => p.name === names.name,
  );
  const env =
    project?.environments?.find((e) => e.name === 'production') ??
    project?.environments?.[0];
  return {
    project,
    env,
    db: env?.postgres?.find((x) => x.name === names.dbName),
    web: env?.applications?.find((x) => x.name === names.webName),
  };
}

/** Чи вже є домен на застосунку (лише для вже наявного застосунку). */
export async function domainExists(call, web, host) {
  if (!web) return false;
  const domains = await call('domain.byApplicationId', {
    query: { applicationId: web.applicationId },
  });
  return domains.some((d) => d.host === host);
}

/** Dokploy може ще не показувати щойно створений ресурс: коротко повторюємо, далі — зрозуміла помилка. */
export async function awaitResource(call, names, pick, what) {
  for (let i = 0; i < RETRIES; i++) {
    const state = await readState(call, names);
    if (pick(state)) return state;
    await new Promise((r) =>
      setTimeout(r, Number(process.env.PROVISION_RETRY_MS ?? 1000)),
    );
  }
  throw new Error(`Dokploy ще не показує ${what}: повтори команду`);
}

/**
 * Дії (потребують `--confirm`) і примітки (лише інформація, без дії).
 * Статус БД, окрім `idle`/`done`/`running`, не гадаємо: показуємо власнику.
 */
export function planLines(state, o) {
  const { names, target, hasRecord, hasDomain, secretsPath, appPort } = o;
  const status = state.db?.applicationStatus;
  const actions = [
    !state.project && `створити проєкт ${names.name}`,
    !state.db &&
      `створити і запустити Postgres 17 ${names.dbName} ${target} (власний екземпляр магазину; паролі — лише у файл секретів)`,
    !state.db &&
      dbSecretsKind(secretsPath) === 'custom' &&
      'перезаписати DATABASE_URL, MIGRATION_DATABASE_URL у файлі секретів (там уже внесені значення)',
    status === 'idle' &&
      `запустити Postgres ${names.dbName} (створений, але не запущений)`,
    !state.web && `створити застосунок ${names.webName} ${target}`,
    !hasDomain &&
      `додати домен ${names.domain} (https, letsencrypt, порт ${appPort})`,
    !hasRecord && 'записати .simplycms/deploy.json (без секретів)',
  ].filter(Boolean);
  const notes = [
    state.db &&
      status !== 'idle' &&
      !RUNNING.includes(status) &&
      `статус БД ${status ?? 'невідомий'}: перевір у Dokploy`,
  ].filter(Boolean);
  return { actions, notes };
}
