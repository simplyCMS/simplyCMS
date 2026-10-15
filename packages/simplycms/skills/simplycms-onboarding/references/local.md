# Локальний запуск

Прев'ю → згода перед кожним кроком, що ставить щось на машині власника.

1. Postgres 17 у контейнері (окремий порт, том для даних). Пароль не в аргументах: власник кладе
   `POSTGRES_PASSWORD=<значення>` у файл `pg.env` (0600, у `.gitignore`), далі:
   `docker run -d --name <slug>-pg --env-file pg.env -p 54329:5432 -v <slug>-pg:/var/lib/postgresql/data postgres:17`.
2. `cp .env.example .env.local`; `DATABASE_URL` — роль `app_runtime`, `MIGRATION_DATABASE_URL` —
   власник схеми, `BETTER_AUTH_SECRET` — `secrets-file.mjs gen`, `VITE_SITE_URL=http://localhost:3000`.
3. `pnpm install`, потім `pnpm simplycms db:apply`.
4. `pnpm simplycms doctor --online` — має бути без помилок.
5. `pnpm owner:invite` (адресу власника задай `OWNER_EMAIL`); без пошти лист не піде — для локального
   запуску посилання бере власник із вікна, а не з виводу агента.
6. `pnpm dev`, перевір вітрину та `/admin`; зупини процес за PID, який сам запустив.
