#!/usr/bin/env node
/**
 * Розгортання магазину в Dokploy: проєкт → власний Postgres 17 → застосунок → домен.
 *
 *   dokploy.mjs provision --name <імʼя> --domain <хост> --bucket <бакет> --secrets <файл> [--confirm]
 *
 * Ідемпотентно: кожен ресурс спершу шукається за імʼям (`<імʼя>`, `<імʼя>-db`,
 * `<імʼя>-web`), створюється лише відсутній. Без `--confirm` — прев'ю і код 3, жодного
 * не-GET запиту. Паролі БД генеруються тут і лягають ЛИШЕ у файл секретів
 * (`MIGRATION_DATABASE_URL` — власник схеми, `DATABASE_URL` — `app_runtime`); у вивід
 * вони не потрапляють. Запис `deploy.json` формується з відповідей Dokploy і параметрів
 * команди й пишеться через `simplycms deploy:record set`.
 */
import { randomBytes } from 'node:crypto';

import {
  credentials,
  DEFAULT_SECRETS,
  dokploy,
  readDeployRecord,
  requireConfirm,
  takeFlag,
  writeDeployRecord,
} from './dokploy-client.mjs';
import { ensureGitignored, setSecret } from './secrets-store.mjs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const confirm = takeFlag(args, '--confirm', false);
const [name, domain, bucket] = ['--name', '--domain', '--bucket'].map((f) =>
  takeFlag(args, f),
);
const secrets = takeFlag(args, '--secrets') ?? DEFAULT_SECRETS;
if (args[0] !== 'provision' || !name || !domain || !bucket) {
  console.error(
    'Використання: dokploy.mjs provision --name N --domain HOST --bucket B [--secrets ФАЙЛ] [--confirm]',
  );
  process.exit(2);
}
const dbName = `${name}-db`;
const webName = `${name}-web`;

try {
  const creds = credentials(secrets);
  const call = (path, opts) => dokploy(creds, path, opts);
  const find = async () => {
    const project = (await call('project.all')).find((p) => p.name === name);
    const env =
      project?.environments?.find((e) => e.name === 'production') ??
      project?.environments?.[0];
    return {
      project,
      env,
      db: env?.postgres?.find((x) => x.name === dbName),
      web: env?.applications?.find((x) => x.name === webName),
    };
  };
  let state = await find();
  const domains = state.web
    ? await call('domain.byApplicationId', {
        query: { applicationId: state.web.applicationId },
      })
    : [];
  const hasDomain = domains.some((d) => d.host === domain);
  const plan = [
    !state.project && `створити проєкт ${name}`,
    !state.db &&
      `створити Postgres 17 ${dbName} (власний екземпляр магазину; паролі — лише у файл секретів)`,
    !state.web && `створити застосунок ${webName}`,
    !hasDomain && `додати домен ${domain} (https, letsencrypt, порт 3000)`,
  ].filter(Boolean);
  if (plan.length === 0) console.log('Усе вже створено, нічого міняти.');
  else requireConfirm(confirm, plan);

  const password = {
    owner: randomBytes(24).toString('hex'),
    runtime: randomBytes(24).toString('hex'),
  };
  const post = (path, body) => call(path, { method: 'POST', body });
  if (!state.project) {
    await post('project.create', { name, description: 'SimplyCMS store' });
    state = await find();
  }
  if (!state.db) {
    await post('postgres.create', {
      name: dbName,
      databaseName: name.replace(/\W/g, '_'),
      databaseUser: 'postgres',
      databasePassword: password.owner,
      dockerImage: 'postgres:17',
      environmentId: state.env.environmentId,
    });
    state = await find();
    const dbUrl = (user, pw) =>
      `postgresql://${user}:${pw}@${state.db.appName}:5432/${name.replace(/\W/g, '_')}`;
    const path = resolve(secrets);
    setSecret(
      path,
      'MIGRATION_DATABASE_URL',
      dbUrl('postgres', password.owner),
    );
    setSecret(path, 'DATABASE_URL', dbUrl('app_runtime', password.runtime));
    ensureGitignored(path);
  }
  if (!state.web) {
    await post('application.create', {
      name: webName,
      environmentId: state.env.environmentId,
    });
    state = await find();
  }
  if (!hasDomain)
    await post('domain.create', {
      host: domain,
      applicationId: state.web.applicationId,
      port: 3000,
      https: true,
      certificateType: 'letsencrypt',
      domainType: 'application',
    });
  if (!readDeployRecord())
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
