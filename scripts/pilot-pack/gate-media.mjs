/**
 * Gate MEDIA — ЗАПАКОВАНЕ ядро вибирає драйвер `s3` за env і пише у справжній
 * Garage (К3-Е8, Task 13). Повний режим, після Gate B.
 *
 * Дочірній процес у скретчі імпортує `simplycms/storage` з його `node_modules`:
 * `put` → `open` віддає ті самі байти. Далі ГЕЙТ (не дочірній) підписаним `HEAD`
 * сам питає Garage, чи об'єкт справді там: драйвер `local-fs`, що мовчки
 * підставився б замість `s3`, поклав би файл на диск, і `HEAD` дав би 404 — саме
 * цей клас дефекту (забутий `S3_*` у запакованому магазині) гейт і ловить.
 * Наприкінці `delete` і повторний `HEAD` (404): гейт не лишає сміття в бакеті.
 *
 * Очікуваний стан береться з `PILOT_S3_*` (що прогін ХОТІВ), а не з env скретча:
 * інакше випадіння `S3_*` з env скретча перетворило б гейт на тихий skip.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { skippedGate } from './report.mjs';
import { runInStore } from './store-child.mjs';

const REPO_ROOT = join(import.meta.dirname, '../..');
const TAG = 'GATE_MEDIA';

/** 1×1 PNG: валідний образ, щоб не залежати від того, що драйвер колись почне сніфити. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PUT_SOURCE = `
import { getMediaDriver, mediaKey } from 'simplycms/storage';
const driver = getMediaDriver();
const bytes = Buffer.from('${PNG_BASE64}', 'base64');
const key = mediaKey('image/png');
await driver.put(key, bytes);
const obj = await driver.open(key);
const read = obj ? Buffer.from(await new Response(obj.stream()).arrayBuffer()) : null;
console.log('${TAG} ' + JSON.stringify({ key, same: read !== null && read.equals(bytes), size: obj?.size ?? null }));
`;

const deleteSource = (key) => `
import { getMediaDriver } from 'simplycms/storage';
const driver = getMediaDriver();
await driver.delete(${JSON.stringify(key)});
console.log('${TAG} ' + JSON.stringify({ gone: (await driver.open(${JSON.stringify(key)})) === null }));
`;

/** Намір прогону: повна група `PILOT_S3_*` або `null`. */
function intendedS3() {
  const pick = (k) => process.env[`PILOT_S3_${k}`];
  const cfg = {
    endpoint: pick('ENDPOINT'),
    region: pick('REGION'),
    bucket: pick('BUCKET'),
    accessKey: pick('ACCESS_KEY'),
    secretKey: pick('SECRET_KEY'),
  };
  return Object.values(cfg).every(Boolean) ? cfg : null;
}

/** Підписаний `HEAD` у Garage з процесу гейту; `aws4fetch` береться з пакета ядра. */
async function headStatus(cfg, key) {
  const { AwsClient } = createRequire(
    join(REPO_ROOT, 'packages/simplycms/package.json'),
  )('aws4fetch');
  const client = new AwsClient({
    accessKeyId: cfg.accessKey,
    secretAccessKey: cfg.secretKey,
    region: cfg.region,
    service: 's3',
    retries: 0,
  });
  const res = await client.fetch(`${cfg.endpoint}/${cfg.bucket}/${key}`, {
    method: 'HEAD',
  });
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

/**
 * @param {string} storeDir
 * @param {Record<string,string>} env env скретча
 * @param {{ packOnly?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean; skipped?: boolean; details: string[] }>}
 */
export async function gateMedia(storeDir, env, { packOnly = false } = {}) {
  if (packOnly) return skippedGate('Gate MEDIA — у --pack-only немає Garage');
  const s3 = intendedS3();
  if (!s3)
    return skippedGate(
      'Gate MEDIA — не задано PILOT_S3_* (повний прогін робить `pilot-full` із .env.harness)',
    );

  const details = [];
  let ok = true;
  const check = (label, passed, fact) => {
    details.push(`${passed ? 'OK  ' : 'FAIL'} ${label} — ${fact}`);
    if (!passed) ok = false;
  };

  const put = runInStore(storeDir, env, PUT_SOURCE, TAG);
  const key = typeof put.report?.key === 'string' ? put.report.key : null;
  check(
    'запакований simplycms/storage: put → open віддає ті самі байти',
    key !== null && put.report?.same === true,
    key
      ? `розмір ${put.report?.size}, байти збігаються: ${put.report?.same}`
      : `дочірній без звіту (код ${put.status}): ${put.error}`,
  );
  if (key === null) return { ok: false, details };

  try {
    const status = await headStatus(s3, key);
    check(
      'підписаний HEAD у Garage бачить об’єкт (драйвер s3, не local-fs)',
      status === 200,
      `HEAD → ${status}`,
    );
  } catch (e) {
    check('підписаний HEAD у Garage', false, `збій запиту: ${e.message}`);
  }

  const del = runInStore(storeDir, env, deleteSource(key), TAG);
  let after = '—';
  try {
    after = String(await headStatus(s3, key));
  } catch (e) {
    after = `збій: ${e.message}`;
  }
  check(
    'delete прибирає об’єкт з бакета',
    del.report?.gone === true && after === '404',
    `open → null: ${del.report?.gone}, HEAD → ${after}`,
  );
  return { ok, details };
}
