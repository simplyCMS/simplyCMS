# Dokploy

Облікові дані — у файлі секретів (`secrets-file.mjs init .simplycms/secrets.env`, власник вносить
`DOKPLOY_URL` і `DOKPLOY_API_KEY`). Усі команди нижче — без `--confirm` спершу (прев'ю).

## 1. Ресурси

```bash
node .claude/skills/simplycms-onboarding/scripts/dokploy.mjs provision --name <slug> --domain <хост> --bucket <бакет> --server <serverId>
```

`--server` — сервер застосунків (той самий `serverId`, що й у `prod-run`): без нього ресурси стануть на
хості панелі, і §7 не знайде контейнер. Створює (лише відсутнє, пошук за іменем): проєкт `<slug>`,
Postgres `<slug>-db` (і запускає його), застосунок `<slug>-web`, домен. Паролі БД лягають у файл секретів (`MIGRATION_DATABASE_URL`, `DATABASE_URL`), не у вивід.
Ідентифікатори йдуть у `.simplycms/deploy.json` через `pnpm simplycms deploy:record set`.

- **Власний екземпляр Postgres на магазин**: ролі `app_runtime`/`app_admin` кластерні, синк пароля
  одного магазину ламає інший, `SET LOCAL ROLE app_admin` бачить чужу базу. Не вибирай існуючий сервіс.
- **Postgres 17.** Дефолтний образ Dokploy — `postgres:18`, його том монтується не туди (`/var/lib/postgresql`):
  дані зникають на рестарті. Скрипт задає `postgres:17`; перевір mount `/var/lib/postgresql/data`.
- Внутрішній hostname БД — appName (із суфіксом Dokploy), а не `name` з UI; він уже в URL.

## 2. Збірка

Кожен підпункт — мутація: прев'ю → згода → застосувати (MCP Dokploy або UI; `RAILPACK_*` — не там).
У застосунку: джерело — git-репозиторій магазину (MCP application-saveGithubProvider або saveGitProvider),
збірка — **Railpack** (`application-saveBuildType`), autoDeploy на `main` (`application-update`).
Змінні збірки задаються через `dokploy-env set` зі stdin, не MCP:

```
RAILPACK_START_CMD="node scripts/start.mjs"
RAILPACK_NODE_VERSION=24
```

`start.mjs` накочує міграції під `MIGRATION_DATABASE_URL`, далі підміняє процес на `server.mjs` без
цієї змінної. Усе, що потрібно на старті, має бути в `dependencies`. `createEnvFile` — завжди `false`
(інакше `.env` із секретами потрапить в образ); `dokploy-env` ставить його сам.

## 3. Змінні (по одній, значення лише з файлу секретів)

```bash
S=.claude/skills/simplycms-onboarding/scripts
node $S/secrets-file.mjs gen .simplycms/secrets.env BETTER_AUTH_SECRET
node $S/secrets-file.mjs pipe .simplycms/secrets.env DATABASE_URL | node $S/dokploy-env.mjs set DATABASE_URL --confirm
```

Обовʼязкові: `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BETTER_AUTH_SECRET`, `VITE_SITE_URL`
(https-адреса домену), плюс повні групи `S3_*` (п'ять ключів) і `SMTP_URL`+`MAIL_FROM` — «все або нічого».
Перевір імена: `dokploy-env.mjs keys`.

## 4. Домен і TLS

Домен створює `provision` (https, Let's Encrypt, порт 3000). DNS: запис на IP сервера, у Cloudflare —
**DNS only** (без проксі), доки сертифікат не виданий. Запис DNS створює власник.

## 5. Бекапи

Мутація: прев'ю → згода. Через MCP `backup-create` (destination — `destination-*`) або UI: сервіс Postgres →
Backups, щоденно, S3-destination, зберігати ≥14. Бекап тому/бакета — `references/backups-restore.md`.
Вмикай ДО першого запису даних.

## 6. Деплой і перевірка

Деплой — теж мутація (прев'ю → згода): MCP `application-deploy` або кнопка Deploy. Дочекайся `running`, тоді:

```bash
pnpm simplycms doctor --online --production
pnpm simplycms smoke https://<домен>
```

## 7. Запрошення власника (ПІСЛЯ налаштування SMTP)

Разовий скрипт на сервері через `prod-run.mjs` (контейнер застосунку знаходь за appName), `OWNER_EMAIL`
з вимог, **без `--print-link`**; сам `prod-run`-скрипт не друкує секретів (його вивід іде в розмову агента): посилання з адмінським токеном не має потрапити у вивід, що йде в розмову
агента. Лист із посиланням приходить власнику на пошту.

```bash
# запрошення власника
docker exec -e OWNER_EMAIL=<пошта> $(docker ps -qf name=<appName застосунку>) node scripts/owner-invite.mjs
```

Запуск: `node $S/prod-run.mjs --server <serverId> invite.sh` (прев'ю → `--confirm`).
