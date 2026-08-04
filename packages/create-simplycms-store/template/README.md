# Магазин на SimplyCMS

Каркас магазину (вітрина, адмінка, профіль, кошик, чекаут) приходить пакетами
`@simplycms/*` із npm. Цей репозиторій — тонка збірка: конфіг, тема, плагіни й
власні роути в `src/routes/my/`.

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

**Для хмарного проєкту** вміст `supabase/templates/invite.html` треба
продублювати в Dashboard → Authentication → Email Templates → «Invite user»:
стандартний лист Supabase не передає `token_hash` у query, і серверний роут
`/auth/confirm` його не побачить. Локальний стек (`supabase start`) бере шаблон
із `supabase/config.toml` автоматично.

### 4. Запустити

```bash
pnpm dev      # розробка
```

Прод:

```bash
pnpm build    # dist/client + dist/server
pnpm start    # node server.mjs (порт — PORT, за замовчуванням 3000)
```

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
