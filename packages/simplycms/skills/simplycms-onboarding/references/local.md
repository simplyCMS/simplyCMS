# Локальний запуск

Прев'ю → згода перед кожним кроком, що ставить щось на машині власника.

1. Postgres 17 у контейнері (окремий порт, том для даних), наприклад:
   `docker run -d --name <slug>-pg -e POSTGRES_PASSWORD=<з файлу> -p 54329:5432 -v <slug>-pg:/var/lib/postgresql/data postgres:17`.
   Пароль у `docker run` потрапляє в історію shell: бери з локального `.env.local` через `--env-file`.
2. `cp .env.example .env.local`; `DATABASE_URL` — роль `app_runtime`, `MIGRATION_DATABASE_URL` —
   власник схеми, `BETTER_AUTH_SECRET` — `secrets-file.mjs gen`, `VITE_SITE_URL=http://localhost:3000`.
3. `pnpm install`, потім `pnpm simplycms db:apply`.
4. `pnpm simplycms doctor --online` — має бути без помилок.
5. `pnpm owner:invite` (адресу власника задай `OWNER_EMAIL`); без пошти лист не піде — для локального
   запуску посилання бере власник із вікна, а не з виводу агента.
6. `pnpm dev`, перевір вітрину та `/admin`; зупини процес за PID, який сам запустив.
