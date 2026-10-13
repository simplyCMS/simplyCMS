#!/usr/bin/env node
/**
 * Розгортання магазину в Dokploy: проєкт → власний Postgres 17 → застосунок → домен.
 *
 *   dokploy.mjs provision --name <імʼя> --domain <хост> --bucket <бакет> [--server <serverId>]
 *                         [--secrets <файл>] [--confirm]
 *
 * Ідемпотентно: ресурс шукається за імʼям (`<імʼя>`, `<імʼя>-db`, `<імʼя>-web`), створюється
 * лише відсутній. Без `--confirm` — прев'ю (разом із записом `deploy.json` і цільовим сервером)
 * і код 3, жодного не-GET запиту, жодного файлу. Паролі БД лягають ЛИШЕ у файл секретів;
 * `--server` — сервер застосунків (де потім працює `prod-run`), без нього ресурси стають
 * на хості панелі. Запис `deploy.json` — з відповідей Dokploy через `simplycms deploy:record set`.
 */
import { resolve } from 'node:path';

import {
  credentials,
  DEFAULT_SECRETS,
  dokploy,
  readDeployRecord,
  requireConfirm,
  takeFlag,
  writeDeployRecord,
} from './dokploy-client.mjs';
import {
  assertDbSecrets,
  bindDbHost,
  reserveDbSecrets,
} from './provision-secrets.mjs';
import {
  domainExists,
  planLines,
  readState,
  awaitResource,
} from './provision-state.mjs';

// Узгоджено з PORT у server.mjs магазину (за замовчуванням 3000).
const APP_PORT = 3000;

const args = process.argv.slice(2);
const confirm = takeFlag(args, '--confirm', false);
const [name, domain, bucket, serverId] = [
  '--name',
  '--domain',
  '--bucket',
  '--server',
].map((f) => takeFlag(args, f));
const secrets = takeFlag(args, '--secrets') ?? DEFAULT_SECRETS;
if (args[0] !== 'provision' || !name || !domain || !bucket) {
  console.error(
    'Використання: dokploy.mjs provision --name N --domain HOST --bucket B [--server ID] [--secrets ФАЙЛ] [--confirm]',
  );
  process.exit(2);
}
const dbName = `${name}-db`;
const webName = `${name}-web`;
const dbSchema = name.replace(/\W/g, '_');
const secretsPath = resolve(secrets);

try {
  const creds = credentials(secrets);
  const call = (path, opts) => dokploy(creds, path, opts);
  const post = (path, body) => call(path, { method: 'POST', body });
  const names = { name, dbName, webName, domain };
  let state = await readState(call, names);
  if (state.db) assertDbSecrets(secretsPath, dbName);
  const hasDomain = await domainExists(call, state.web, domain);
  const hasRecord = readDeployRecord() !== null;
  const { actions, notes } = planLines(state, {
    names,
    hasRecord,
    hasDomain,
    secretsPath,
    appPort: APP_PORT,
    target: serverId
      ? `на сервері ${serverId}`
      : 'на хості панелі Dokploy (без --server)',
  });
  const startDb = state.db?.applicationStatus === 'idle';
  if (actions.length === 0) {
    console.log('Усе вже створено, нічого міняти.');
    for (const note of notes) console.log(`  - ${note}`);
    process.exit(0);
  }
  requireConfirm(confirm, [...actions, ...notes]);

  const createDb = !state.db;
  const where = serverId ? { serverId } : {};
  if (!state.project) {
    await post('project.create', { name, description: 'SimplyCMS store' });
    state = await awaitResource(call, names, (s) => s.env, `проєкт ${name}`);
  }
  if (createDb) {
    const ownerPassword = reserveDbSecrets(secretsPath, dbSchema);
    await post('postgres.create', {
      name: dbName,
      databaseName: dbSchema,
      databaseUser: 'postgres',
      databasePassword: ownerPassword,
      dockerImage: 'postgres:17',
      environmentId: state.env.environmentId,
      ...where,
    });
    state = await awaitResource(call, names, (s) => s.db, dbName);
  }
  bindDbHost(secretsPath, state.db.appName);
  if (createDb || startDb)
    await post('postgres.deploy', { postgresId: state.db.postgresId });
  if (!state.web) {
    await post('application.create', {
      name: webName,
      environmentId: state.env.environmentId,
      ...where,
    });
    state = await awaitResource(call, names, (s) => s.web, webName);
  }
  if (!hasDomain)
    await post('domain.create', {
      host: domain,
      applicationId: state.web.applicationId,
      port: APP_PORT,
      https: true,
      certificateType: 'letsencrypt',
      domainType: 'application',
    });
  if (!hasRecord)
    writeDeployRecord({
      version: 1,
      dokploy: {
        url: creds.url.replace(/\/api$/, ''),
        projectId: state.project.projectId,
        applicationId: state.web.applicationId,
        postgresId: state.db.postgresId,
      },
      domain,
      bucket,
      createdAt: new Date().toISOString(),
    });
  console.log(
    `Готово: проєкт ${name}, ${dbName}, ${webName}, домен ${domain}. Далі — змінні (dokploy-env) і деплой.`,
  );
} catch (error) {
  console.error(`dokploy: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
