// Запис розгортання `.simplycms/deploy.json` — закомічений, без секретів (Е8-Б4).
// Єдина схема: `status` по ньому визначає етап `deployed` і домен для /api/health,
// скіл деплою його пише. Секрети (токен Dokploy, ключі S3, БД) лежать у `.env*`/Dokploy.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const DEPLOY_RECORD_PATH = '.simplycms/deploy.json';

const TOP_KEYS = ['version', 'dokploy', 'domain', 'bucket', 'createdAt'];
const DOKPLOY_KEYS = ['url', 'projectId', 'applicationId', 'postgresId'];
const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

const isRecord = (x) =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const nonEmpty = (x) => typeof x === 'string' && x.trim() !== '';

/** Поле поза схемою відкидається: так у запис не потрапить випадковий `apiKey`. */
function assertKeys(obj, allowed, where) {
  const extra = Object.keys(obj).filter((key) => !allowed.includes(key));
  if (extra.length > 0)
    throw new Error(`${where}: поле поза схемою — ${extra.join(', ')}`);
  for (const key of allowed)
    if (!(key in obj)) throw new Error(`${where}: немає поля ${key}`);
}

/**
 * Адреса панелі без облікових даних: userinfo, query і hash — типові місця токена.
 * Значення в повідомленні не повторюється.
 */
function assertDokployUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('dokploy.url: не адреса');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('dokploy.url: очікується http(s)');
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      'dokploy.url: адреса не має містити userinfo, query чи hash',
    );
}

/**
 * Перевірити запис (перевірки лише форми, не слів на кшталт `secret`: імена ресурсів
 * дали б хибні спрацювання).
 * @param {unknown} rec
 * @returns {{ version: 1, dokploy: { url: string, projectId: string, applicationId: string, postgresId: string }, domain: string, bucket: string, createdAt: string }}
 */
export function validateDeployRecord(rec) {
  if (!isRecord(rec)) throw new Error('очікується обʼєкт');
  assertKeys(rec, TOP_KEYS, 'deploy.json');
  if (rec.version !== 1) throw new Error('version: очікується 1');
  if (!isRecord(rec.dokploy)) throw new Error('dokploy: очікується обʼєкт');
  assertKeys(rec.dokploy, DOKPLOY_KEYS, 'dokploy');
  for (const key of DOKPLOY_KEYS)
    if (!nonEmpty(rec.dokploy[key])) throw new Error(`dokploy.${key}: порожнє`);
  assertDokployUrl(rec.dokploy.url);
  // Домен йде в `https://<domain>/api/health`: лише імʼя хоста, без схеми й шляху.
  if (!nonEmpty(rec.domain) || !HOSTNAME.test(rec.domain))
    throw new Error('domain: очікується імʼя хоста без схеми й шляху');
  if (!nonEmpty(rec.bucket)) throw new Error('bucket: порожнє');
  if (!nonEmpty(rec.createdAt) || Number.isNaN(Date.parse(rec.createdAt)))
    throw new Error('createdAt: очікується дата ISO');
  return rec;
}

/**
 * Запис розгортання або `null`, якщо файлу немає. Нечитний чи невалідний файл кидає:
 * `status` кладе це в `unknown`, а не вдає «ще не розгорнуто».
 */
export function readDeployRecord(storeRoot) {
  const path = join(storeRoot, DEPLOY_RECORD_PATH);
  if (!existsSync(path)) return null;
  return validateDeployRecord(JSON.parse(readFileSync(path, 'utf8')));
}

/** Записати після валідації; невалідне на диск не потрапляє. */
export function writeDeployRecord(storeRoot, rec) {
  const valid = validateDeployRecord(rec);
  const path = join(storeRoot, DEPLOY_RECORD_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(valid, null, 2)}\n`);
}
