# create-simplycms-store + bootstrap власника магазину

> **Статус:** затверджений дизайн (власник, 2026-08-03). Створено за процесом
> superpowers brainstorming; дослідницька база — 3 воркфлоу цієї сесії
> (аудит роадмапу · 8 напрямів install-UX · 2 напрями безпеки першого власника),
> ключові факти й джерела продубльовані тут.
> **Батьківські документи:**
> [`2026-07-30-platform-architecture-design.md`](2026-07-30-platform-architecture-design.md)
> (архітектура платформи, Фаза 2),
> [`../../architecture/platform-delivery-options.md`](../../architecture/platform-delivery-options.md)
> (механізм поставки).
> **Трекінг:** [`../../tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md), Фаза 2.

---

## 1. Мета і межі

**Мета v1:** сторонній розробник однією командою створює окремий git-репозиторій
магазину зі справжніх npm-пакетів `@simplycms/*` і має безпечний спосіб зробити
власником магазину конкретну людину (клієнта) — без вікна «хто перший зайшов на
URL, той і адмін».

**Модель використання (зафіксовано власником 2026-08-03):**

- `create-simplycms-store` — **консольний інструмент розробника**. Він створює
  репозиторій; далі розробник розробляє магазин (тема, плагіни, кастомні
  сторінки) і сам підключає його до дев- і прод-контурів.
- Деплой-артефакти (Dockerfile, платформенні шаблони) і спосіб застосування
  міграцій БД — **зона відповідальності розробника**, не наша. Ми даємо
  міграції в репозиторії й документований шлях (`supabase link` + `db push`),
  але не автоматизуємо і не нав'язуємо.
- Ми **не** йдемо шляхом OpenCart/WordPress (web-майстер установки): місія
  проєкту — повнофункціональна адмінка для сучасних React-проєктів, а не
  «клікнув і встановив» для не-розробника. PHP-модель у Vite-стеку і технічно
  недосяжна: `VITE_*` вшиваються в бандл на `vite build`, тож конфіг мусить
  існувати до збірки.

**У скоупі v1:** (а) пакет `create-simplycms-store`; (б) bootstrap власника
через invite при деплої. **Поза скоупом:** §8.

---

## 2. Дослідницька база (стисло, з джерелами)

### 2.1. Де живе інтерактив установки в build-стеку

Жодна JS-платформа не має web-майстра для env/конфігурації — весь інтерактив
до білда живе в Node CLI:

- **create-medusa-app**: inquirer-промпти, створює Postgres, гонить міграції,
  генерує invite-токен і відкриває браузер на
  `/app/invite?token=…&first_run=true` — пароль адміна вводиться у браузерній
  формі, не в CLI (сирці `packages/cli/create-medusa-app`).
- **@vendure/create**: @clack/prompts, пише `.env`, сідує і створює
  суперадміна всередині CLI-процесу до першого HTTP-запиту.
- **create-payload-app / create-next-app / create-t3-app**: пишуть `.env`,
  ставлять залежності; Payload відкладає першого користувача на runtime-екран
  `CreateFirstUser` (рендериться, коли в БД нуль користувачів).
- Механіка create-пакетів: шаблон **вбудований у пакет** (create-next-app,
  create-t3-app) або live-fetch з GitHub (create-astro, create-payload-app);
  версії залежностей — хардкод на момент релізу (create-next-app: версія
  `next` = власна версія пакета) або fetch dist-tags (Payload).
  `npm create x` ≡ `npm exec create-x` (npm/cli `docs/…/npm-init.md`);
  застарілий опублікований create-пакет ламає перший досвід назавжди.

### 2.2. Безпека першого власника

Класи механізмів у self-hosted інструментах: секрет у файлі (Jenkins
`initialAdminPassword`), часове вікно (Portainer: 5 хв → сервер вимикається),
env-креденшели з гейтом «лише при першому старті» (Keycloak
`KC_BOOTSTRAP_ADMIN_*`, Directus `ADMIN_EMAIL/PASSWORD` за
`isInstalled()===false`, Coolify: *«prevents the registration page from ever
being exposed»*), «хто перший встиг» (n8n за замовчуванням, Payload, Strapi).

- **Токен в URL відхилено:** єдиний глибоко задокументований прецедент
  (Drupal one-time login, issue #2515050) — токен протікає через Referer;
  коректна реалізація вимагає стека мітигацій (session-store + негайний
  redirect, одноразовість, TTL 15-30 хв, `Referrer-Policy`). Ми в цьому репо
  самі виносили guest-token з URL (`OrderSuccess.tsx`).
- **Сід-пароль з примусовою зміною відхилено:** категорія застосовна лише до
  систем із власним паролестором (Grafana `admin/admin`); у Supabase Auth
  немає «дефолтного пароля».
- **GUC-патерн (`ALTER DATABASE … SET app.owner_email`) непрацездатний на
  hosted Supabase** — `42501 permission denied` (роль `postgres` не є
  власником БД; supabase/orgs discussion #42972).
- **`auth.admin.inviteUserByEmail(email)`** (service_role): GoTrue сам створює
  користувача (`invited_at` виставлено) і сам шле лист з одноразовим
  посиланням; TTL = «Email OTP Expiration» (дефолт 3600 c). Токен не
  проходить через логи чи URL, якими керує розробник.
- **Дві незалежні осі:** «Allow new users to sign up» регулює лише публічний
  `signUp()`; Admin API працює незалежно. Реєстрація покупців лишається
  відкритою, призначення адмін-ролі — закритим.
- `service_role` має `bypassrls` — INSERT ролі в `user_roles` не впирається в
  наявні RLS-політики (які вимагають уже наявного адміна).

### 2.3. Стан власного коду (аудит цієї сесії)

- 🔴 **Виправлено Codex-аудитом 2026-08-04:** чинний тригер `handle_new_user`
  **робить першого зареєстрованого користувача адміном**
  (`supabase/migrations/20260213120000_fix_handle_new_user_trigger.sql:22-28`,
  `IF user_count <= 1 THEN 'admin'`) — тобто діра «хто перший встиг» не
  гіпотетична, а жива в схемі; план прибирає її новою міграцією (роль завжди
  `user`). RLS на `user_roles` і RPC `toggle_user_admin` вимагають наявного
  адміна для подальшого управління ролями. *(Початкова редакція цього пункту
  стверджувала протилежне — «першого адміна неможливо призначити» — за
  першою міграцією `20260126120345_*`, не помітивши пізнішої.)*
- 32 міграції в `supabase/migrations/`; `supabase/seed.sql` — пілотний
  генерат, не продакшн-сід.
- `scripts/pilot-pack/scaffold.mjs` копіює 11 host-файлів **з кореня
  монорепо** — опублікований create-пакет так не зможе; шаблон
  `tests/pilot/store-template/` містить лише файли, що відрізняються.
- Усі Supabase-клієнти (включно з серверним `server-client.ts:26`) читають
  `import.meta.env` — але для цього дизайну це не блокер: `owner-invite` —
  standalone Node-скрипт поза Vite-збіркою.

---

## 3. Пакет `create-simplycms-store`

### 3.1. Розташування і публікація

- Нова workspace-тека **`packages/create-simplycms-store/`** (unscoped імʼя —
  закриває і згадану в роадмапі резервацію імені; scoped-пакети лишаються в
  `packages/simplycms/*`).
- Публікується **тим самим реліз-потягом**: та сама версія, що й у всіх
  `@simplycms/*`; `pnpm release` бампить і його. Наслідок для тулінгу:
  `pnpm-workspace.yaml`, `scripts/release/bump.mjs` (гард синхронності версій)
  і `publish-packages.yml` мають охоплювати нову теку — якір для плану.
- `bin`: `create-simplycms-store` → CLI-ентрі. Виклик:
  `pnpm create simplycms-store my-shop` (конвенція `create-*` наскрізна для
  npm/pnpm/yarn).

### 3.2. Шаблон — єдине джерело правди

Шаблон живе всередині пакета (`packages/create-simplycms-store/template/`) —
модель create-t3-app: без мережевих залежностей, версія шаблону жорстко
привʼязана до версії пакета.

- Сюди **переїжджають** 11 host-файлів, які `scaffold.mjs` зараз копіює з
  кореня (`server.mjs`, `server-runtime.mjs`, `src/routes/__root.tsx`,
  `src/start.ts`, `src/client.tsx`, `src/router.tsx`, `src/server.ts`,
  `src/server/engine.ts`, `src/engine-provider.tsx`, `src/theme-registry.ts`,
  `src/styles/globals.css`), плюс уже наявні відмінні файли з
  `tests/pilot/store-template/` (`routes.ts`, `simplycms.config.ts`,
  `src/engine.shared.ts`, `tailwind.config.ts`, `vite.config.ts` — **чистий**,
  без пілотної логіки, `tsconfig.json`, `package.json`-шаблон).
- **Пілот перебудовується споживати цей шаблон** замість копіювання з кореня:
  `scaffold.mjs` бере файли з `packages/create-simplycms-store/template/`, а
  пілот-специфіку (`emitBundleStats` для Gate C, tarball-overrides) накладає
  окремим оверлеєм. Наслідок: `pnpm pilot:e2e` стає e2e-тестом справжнього
  create-флоу, а дрейф «шаблон ↔ host» ловиться конструкцією.
  Парність host-файлів кореня з шаблоном стереже окремий тест (модель
  `tests/pilot-seed.test.ts`).
- Шаблон також везе: **`supabase/migrations/`** (snapshot міграцій ядра;
  парність із `supabase/migrations/` монорепо — тест), **`themes/default/`**
  і **`plugins/hello-world/`** (копії на момент релізу, парність — той самий
  тест; пакування тем як npm — Фаза 4), **`.env.example`**, **`README.md`**
  з покроковим «далі», `scripts/owner-invite.mjs` (§4).

### 3.3. Поведінка CLI

Промпти (@clack/prompts) — мінімум:

1. Назва проєкту (або позиційний аргумент).
2. Supabase Project URL + publishable key (з «Connect»-панелі Dashboard) —
   або пропуск; за наявності — пишеться `.env.local`.
3. «Встановити залежності зараз?» (default так).

Автоматично: розгортання шаблону з підставленою назвою; версії `@simplycms/*`
у `package.json` = **власна версія пакета** (без звернень до реєстру);
`git init` + перший коміт; фінальний вивід із трьома наступними кроками
(заповнити `.env.local`, якщо пропустили → `supabase link` + `supabase db push`
→ `pnpm owner:invite` → `pnpm dev`).

Неінтерактивний режим (модель create-t3-app): `--yes` бере дефолти; явні
прапорці `--supabase-url`, `--supabase-key`, `--no-install`, `--no-git`
перекривають промпти. `CI=true`/не-TTY ⇒ як `--yes`.

CLI **не** виконує `supabase link`/`db push` і нічого не деплоїть — міграції
застосовує розробник (рішення §1).

---

## 4. Bootstrap власника: invite при деплої (push-модель)

### 4.1. Механізм

Шаблон везе `scripts/owner-invite.mjs` (pnpm-скрипт `owner:invite`).
Розробник запускає його в консолі, коли схема вже накочена на цільовий
Supabase-проєкт:

```bash
OWNER_EMAIL=client@shop.com SUPABASE_SERVICE_ROLE_KEY=... pnpm owner:invite
```

Скрипт (standalone Node, поза Vite-збіркою; `VITE_SUPABASE_URL` читає з
`.env.local`/env):

1. `auth.admin.inviteUserByEmail(OWNER_EMAIL)` — GoTrue створює користувача
   і шле лист з одноразовим посиланням. *(Уточнення 2026-08-04: стандартний
   invite-лінк несумісний із наявним `?code=`-callback — лист будується за
   кастомним шаблоном `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`,
   шаблон їде в `template/supabase/`, для hosted вставляється в Dashboard.)*
2. INSERT ролі `admin` у `user_roles` для отриманого `user.id` (service_role,
   `bypassrls`).
3. Друкує підсумок: кому надіслано, що робити далі, як перевідправити.

Власник клікає лінк **у своїй пошті**, встановлює пароль — і входить уже
адміном.

### 4.2. Чому це безпечно (модель загроз)

- **Вікна «хто перший встиг» не існує:** публічного шляху «стати адміном»
  немає взагалі; роль призначена до першого кліку; отримати її може лише
  контролер поштової скриньки, яку вказав розробник. Це сильніше за
  Portainer-таймер і незалежне від того, скільки минуло між деплоєм і першим
  входом.
- **Токен не в наших руках:** генерує і доставляє GoTrue; у логах/URL, якими
  керуємо ми чи розробник, він не зʼявляється. TTL — налаштування «Email OTP
  Expiration» проєкту (дефолт 1 год); прострочений invite перевідправляється
  повторним запуском скрипта.
- **`service_role` не потрапляє в рантайм магазину:** живе лише в консолі
  розробника на момент запуску; в `.env.local` не записується, в клієнтський
  бандл потрапити не може (немає префікса `VITE_`).
- Реєстрація покупців (`signUp()`) лишається відкритою — осі незалежні (§2.2).

### 4.3. Ідемпотентність

Повторний запуск: користувач існує з роллю → повідомити і запропонувати
`--resend` (переви́слати invite); існує без ролі → дописати роль; не існує →
повний флоу. Один магазин може мати кількох адмінів — наступні запрошуються
з адмінки штатним шляхом (окрема вісь, поза цим дизайном).

### 4.4. Зміни в ядрі

*(Уточнено за Codex-аудитом 2026-08-04 — перевірка з §9 п.1 виконана:
callback обробляє лише `?code=`, invite так не працює.)* Три зміни:

1. **Міграція `first_user_no_auto_admin`** — тригер більше не дарує `admin`
   першому зареєстрованому (див. §2.3, виправлений факт).
2. **Серверний роут `/auth/confirm`** — `verifyOtp({ type, token_hash })` за
   SSR-моделлю Supabase, дзеркало `callback.tsx` (той самий захист від open
   redirect); редірект одразу прибирає токен з URL.
3. **Канонічна сторінка `/auth/set-password`** — форма встановлення пароля
   із сесією після confirm; успіх → `/admin`.

---

## 5. Опційне продовження (свідомо не v1): pull-модель

Для сценарію «власник невідомий на момент деплою»: секрет в
[Supabase Vault](https://supabase.com/docs/guides/database/vault)
(`vault.create_secret(email,'owner_email')`) + RPC `claim_owner()`, доступна
ролі `authenticated`, що звіряє `auth.jwt()->>'email'` (підписаний GoTrue —
не клієнтський ввід) із vault-значенням і атомарно призначає роль, якщо
власника ще немає. Обовʼязкові гарди при реалізації (з дослідження):

- явний `REVOKE EXECUTE … FROM anon, authenticated` одразу після кожного
  `CREATE FUNCTION` у тій самій міграції — не покладатись на
  `ALTER DEFAULT PRIVILEGES` (задокументований баг supabase/supabase#43884);
- `search_path = ''` + повна кваліфікація схем у кожній SECURITY
  DEFINER-функції (лінтер `0011_function_search_path_mutable`);
- сховище секрету — поза exposed schemas PostgREST.

---

## 6. Тестування

- **`pnpm pilot:e2e` розширюється** кроком owner-флоу: scaffold із шаблону
  пакета → build → запуск проти локального стеку → `owner:invite` проти
  локального GoTrue (service_role локального стеку) → перевірити, що
  запрошений має роль `admin`, а користувач зі звичайного `signUp()` — ні.
  Гейти A–D не змінюються.
- **Парність-тести** (модель `pilot-seed.test.ts`): host-файли кореня ↔
  шаблон пакета; `supabase/migrations/` ↔ snapshot у шаблоні; `themes/default`
  і `plugins/hello-world` ↔ копії в шаблоні. Запускаються в `pnpm test`.
- **CLI-юніти:** генерація `package.json` (версії = власна версія пакета),
  неінтерактивний режим із прапорцями, ідемпотентність повторного запуску
  `owner-invite` (мок Admin API).

---

## 7. DoD

1. `pnpm create simplycms-store my-shop` (або `npx create-simplycms-store`)
   у порожній теці створює git-репозиторій, який після заповнення
   `.env.local`, `supabase db push` і `pnpm owner:invite` дає робочий магазин
   із власником-адміном; `pnpm dev` і `pnpm build && pnpm start` працюють.
2. `pnpm pilot:e2e` зелений і включає owner-флоу.
3. Пілот споживає шаблон пакета (нуль копіювань host-файлів з кореня в
   `scaffold.mjs`); парність-тести в `pnpm test`.
4. Пакет опубліковано реліз-потягом на npmjs.

---

## 8. Поза скоупом v1 (зафіксовано, щоб не розповзалось)

- **`@simplycms/cli`** (`add`/`update`/`doctor`/schematics) — наступна спека
  Фази 2.
- **Деплой-артефакти** (Dockerfile, Dokploy/Render/Vercel шаблони) — зона
  розробника; максимум README-нотатка.
- **Автостворення Supabase-проєкту** через Management API
  (`supabase projects create`) — можливий флаг пізніше.
- **Pull-модель власника** (§5) — після v1 за потребою.
- **Вибір теми в промптах** — теми ще в монорепо (Фаза 4).
- **Migrate-on-boot** (модель Vendure) — свідомо ні: схема вимагає ревʼю SQL
  людиною (політика роадмапу).
- **Переведення серверного env на `process.env`** (ротація ключів без
  ребілду; `server-client.ts` читає `import.meta.env`) — окремий борг,
  не блокує цей дизайн; зафіксований у роадмапі.

---

## 9. Відкриті питання → якорі для плану

1. Чи обробляє наявний auth-контур `type=invite` і чи є екран встановлення
   пароля (§4.4) — `orient` по `storefront-routes` auth-сторінках.
2. Охоплення нової теки реліз-тулінгом: `pnpm-workspace.yaml`,
   `scripts/release/bump.mjs` (лічильник «21 пакет» у гардах/доках),
   `publish-packages.yml`, `audit-deps`/`audit-exports` (чи мають бачити
   unscoped-пакет).
3. Механіка снапшотів у шаблон (міграції/тема/плагін): копіювання на
   `build:packages` чи закомічені копії з парність-тестом — вирішити в плані
   (рекомендація: закомічені копії + тест, як `seed.sql`).
