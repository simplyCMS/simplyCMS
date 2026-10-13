// Онлайн-частина `simplycms status`: ті самі перевірки БД, що в `doctor --online`
// (спільний модуль doctor-db-checks.mjs), плюс живий `/api/health` розгорнутого домену.
// Бюджет усієї команди — 5 с (status.mjs); завдання, що не вклалось, іде в `unknown`.
import { CONNECT_TIMEOUT_MS, runOnlineChecks } from './doctor-db-checks.mjs';
import { check, reason } from './online-state-checks.mjs';

const HEALTH = 'Домен відповідає (/api/health)';

/**
 * `GET https://<domain>/api/health` розгорнутого магазину. Не відповів чи не `healthy` —
 * `error`: етап `deployed` означає, що магазин має працювати.
 * @param {string} domain імʼя хоста з `deploy.json`
 * @param {typeof fetch} [fetchImpl] шов для тесту
 */
export async function healthCheck(domain, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`https://${domain}/api/health`, {
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      redirect: 'manual',
    });
    const body = await res.json().catch(() => null);
    if (res.status !== 200 || body?.status !== 'healthy')
      return check(
        'domain-health',
        HEALTH,
        'error',
        `${domain}: HTTP ${res.status}${body?.status ? `, status=${body.status}` : ''}`,
      );
    return check(
      'domain-health',
      HEALTH,
      'ok',
      typeof body.build === 'string' && body.build !== ''
        ? `збірка ${body.build}`
        : undefined,
    );
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    return check(
      'domain-health',
      HEALTH,
      'error',
      `${domain}: ${timedOut ? `не відповів за ${CONNECT_TIMEOUT_MS} мс` : (error?.cause?.code ?? reason(error))}`,
    );
  }
}

/**
 * Онлайн-перевірки для `status` як окремі завдання `{ label, run }` (як `OFFLINE_CHECKS`):
 * кожне гоняється з дедлайном команди окремо, тож повільна БД не ховає відповідь домену.
 * Домен — лише в етапі `deployed` (є запис розгортання).
 * @param {{ storeRoot: string, env: Record<string, string>, deployRecord: { domain: string } | null }} ctx
 * @param {{ runDb?: typeof runOnlineChecks, fetchImpl?: typeof fetch }} [deps] шви для тестів
 */
export function onlineTasks(
  { storeRoot, env, deployRecord },
  { runDb = runOnlineChecks, fetchImpl } = {},
) {
  const tasks = [{ label: 'стан БД', run: () => runDb({ storeRoot, env }) }];
  if (deployRecord)
    tasks.push({
      label: 'домен (/api/health)',
      run: () => healthCheck(deployRecord.domain, fetchImpl),
    });
  return tasks;
}
