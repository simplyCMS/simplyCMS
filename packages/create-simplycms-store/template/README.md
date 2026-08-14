# Магазин на SimplyCMS

Каркас магазину (вітрина, адмінка, профіль, кошик, чекаут) приходить пакетами
`@simplycms/*` із npm. Цей репозиторій — тонка збірка: конфіг, тема, плагіни й
власні роути в `src/routes/my/`.

## Вимоги

**pnpm 11+** (версія прибита в `packageManager`, тож corepack підтягне її сам)
і **Node 22+**. npm і yarn не підтримуються: магазин налаштований через
`pnpm-workspace.yaml` (`allowBuilds`), а інші менеджери це поле ігнорують і
зберуть проєкт у неперевіреній конфігурації.

> 🔴 **Якщо `pnpm install` скаржиться на `minimumReleaseAge`** — це не помилка
> магазину. pnpm 11 за замовчуванням не ставить пакети, опубліковані менш ніж
> добу тому (захист від supply-chain-атак). Найпростіше — зачекати добу після
> виходу нової версії `@simplycms/*`.
>
> Якщо чекати не можна, тимчасово додай у `pnpm-workspace.yaml`:
> `minimumReleaseAge: 0`, і прибери після установки. Разового прапорця
> `--config.minimumReleaseAge=0` на `pnpm install` **не досить**: `pnpm build`
> сам перезапускає install (`runDepsStatusCheck`) уже без нього і впреться
> знову.

## Наступні кроки

### 1. Заповнити `.env.local`

```bash
cp .env.example .env.local
```

`VITE_SUPABASE_URL` і `VITE_SUPABASE_PUBLISHABLE_KEY` — з панелі **Connect**
у Supabase Dashboard (або Project Settings → API Keys).

### 2. Накотити схему БД

Потрібен [Supabase CLI](https://supabase.com/docs/guides/local-development).
`<project-ref>` — ідентифікатор проєкту з Dashboard → Project Settings →
General.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

`supabase/migrations/` — повна схема ядра SimplyCMS: таблиці, RLS-політики,
тригери.

### 3. Призначити власника

Магазин навмисно не робить адміном «того, хто перший зареєструвався». Власника
призначає власник проєкту — з консолі, ключем `service_role`:

```bash
OWNER_EMAIL=you@example.com SUPABASE_SERVICE_ROLE_KEY=<service-role-key> pnpm owner:invite
```

🔴 `service_role`-ключ **ніколи** не записується у файли (ні в `.env.local`, ні
в репозиторій) — лише змінна середовища на час запуску команди. Ключ дає повний
доступ до БД в обхід RLS.

На пошту прийде лист-запрошення; посилання веде на `/auth/set-password`, де
запрошений задає пароль і одразу входить.

**Для хмарного проєкту** треба зробити ДВІ речі в Dashboard — `supabase db push`
накочує тільки міграції, секція `[auth]` із `supabase/config.toml` на хмару не
потрапляє:

1. **Authentication → Email Templates → «Invite user»** — продублювати вміст
   `supabase/templates/invite.html`. Стандартний лист Supabase не передає
   `token_hash` у query, і серверний роут `/auth/confirm` його не побачить.
2. **Authentication → URL Configuration** — `Site URL` поставити рівним
   публічній адресі магазину (напр. `https://your-domain.com`) і додати її ж у
   `Redirect URLs`. Лінк у листі будується з `{{ .SiteURL }}`, а дефолт нового
   проєкту — `http://localhost:3000`, тож без цієї правки запрошення поведе
   власника на його ж локальну машину.

Локальний стек (`supabase start`) бере і шаблон, і `site_url` із
`supabase/config.toml` автоматично — там уже прописано `http://localhost:3000`.

CLI-альтернатива другому пункту — `supabase config push`. 🔴 Він відправляє
**весь** локальний `config.toml`, а не лише `site_url`: усе, чого немає у
файлі, віддалений проєкт отримає дефолтами CLI, і ручні auth-налаштування в
Dashboard (провайдери, TTL, ліміти) буде перезаписано. Для одного поля
безпечніше Dashboard.

### 4. Запустити

```bash
pnpm dev      # розробка, http://localhost:3000
```

Порт dev-сервера прибитий у `vite.config.ts` до `3000` — щоб збігався з
`pnpm start` і з `site_url` локального стеку, інакше лінк із листа-запрошення
вів би на порожній порт.

Прод:

```bash
pnpm build    # dist/client + dist/server
pnpm start    # node server.mjs (порт — PORT, за замовчуванням 3000)
```

### 5. Перевірити себе

```bash
pnpm simplycms doctor
```

Read-only діагностика магазину: версії ядра, env, host-файли, міграції, конфіг.
Той самий CLI (`@simplycms/cli`, уже в `devDependencies`) далі обслуговує
магазин: `simplycms add` — встановлення плагінів/тем, `simplycms update` —
оновлення ядра з доганянням host-файлів, `simplycms db:diff` — донесення нових
core-міграцій. Повна інструкція —
[docs/architecture/cli.md](https://github.com/simplyCMS/simplyCMS/blob/main/docs/architecture/cli.md).

## Що де лежить

| Шлях                  | Призначення                                        |
| --------------------- | -------------------------------------------------- |
| `simplycms.config.ts` | Конфіг магазину: SEO, локаль, валюта, теми, плагіни |
| `routes.ts`           | Монтування роутів ядра + власних (`src/routes/my/`) |
| `src/routes/my/`      | Кастомні сторінки цього магазину                    |
| `themes/default/`     | Активна тема: manifest + tokens + components        |
| `plugins/`            | Встановлені плагіни                                 |
| `supabase/migrations/`| Схема БД (ядро SimplyCMS)                           |
| `scripts/`            | Обслуговуючі команди магазину (`owner:invite`)      |
