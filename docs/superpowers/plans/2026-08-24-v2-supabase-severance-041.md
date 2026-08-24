# План 0.4.1: зняти Supabase зі шляху вітрини + чистий env

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Магазин має підніматись і рендеритись **без жодної змінної
`VITE_SUPABASE_*`** — без фіктивних ключів, із чесним health-ендпоінтом і
env-файлами, очищеними від мертвих ключів.

**Architecture:** Варіант (а), ухвалений власником 2026-08-24: Supabase
знімається зі шляху **вітрини**; залежність `@supabase/supabase-js`
лишається виключно під непрацюючою адмінкою і зникає сама в треку К3.
Більшість роботи — **видалення мертвого коду**: аудит 2026-08-24 довів, що
шар репозиторіїв (`data-supabase`, порт-хуки, серверний рушій) має **нуль
споживачів** навіть в адмінці.

**Tech Stack:** без нових залежностей. Наявні: TanStack Start/Router,
Drizzle + `simplycms/db` (`withActor`), vitest, пілот, eslint-зони.

**Спека напряму:** [`2026-08-19-backend-contract-v2-design.md`](../specs/2026-08-19-backend-contract-v2-design.md)
— B1 (браузер не ходить у БД), B2 (контракт — чистий Postgres), B11 (без
зворотної сумісності, старий шар зноситься в тому ж контурі). Окремої спеки
цей план не потребує: напрям ухвалений, це доробка контуру К1′б.
**Доказова база:** аудит 2026-08-24 (memory `v2-audit-2026-08-24`).

## Global Constraints

- 🔴 **Жодних тихих заглушок** (рішення власника 2026-08-24). Де функція не
  працює — вона падає **гучно й зрозуміло**, із назвою треку, що її оживить.
  Чинний прецедент: `MediaProvider` без `delete`/`transform` свідомо не
  підмінений «успішною» заглушкою (v2-state-map §3.2).
- 🔴 **Адмінку НЕ чіпаємо**: її 50 файлів переписує К3. Дозволено рівно одне —
  вона перестає отримувати Supabase-клієнт із провайдера вітрини й падає
  гучно замість нескінченного «Завантаження».
- 🔴 **Гейти після КОЖНОЇ задачі** канонічним порядком:
  `pnpm install --frozen-lockfile → format:check → lint → build → typecheck
  → test → build:packages → test:packaging`; після задач, що чіпають схему
  чи БД — додатково `pnpm test:schema`; `pnpm pilot:pack` — де позначено.
- 🔴 **`pnpm template:sync` після будь-якої правки host-файлів** (`src/*`):
  вони мають ТРИ дзеркала — `packages/cli/host/`, `template/` скаффолдера,
  і всі під parity-тестами.
- Локальний стенд для перевірок — memory `v2-local-test-stand`: контейнер
  `pgvector/pgvector:pg17` з `POSTGRES_HOST_AUTH_METHOD=trust` на порту
  55433, `PG_HARNESS_URL`/`db:demo`. 🔴 `grep` по збережених HTML сторінках
  бреше (файл містить `\0`) — використовуй `rg -a`.
- Коментарі українською; TS strict 5.9; файли ≤150 рядків; нові кириличні
  UI-рядки — лише через i18n-каталоги.
- Версія релізу — **0.4.1** (Task 8).

## Що виміряно перед планом (щоб виконавець не перевідкривав)

| Символ | Споживачів поза `react-query/` | Доля |
|---|---|---|
| `useProduct`, `useProducts`, `useSections`, `useProperties`, `useStockInfo`, `useOrder`, `useOrders` | **0** (адмінка теж 0) | видалити |
| `catalogQueries`, `orderQueries`, `orderKeys` | **0** | видалити |
| `catalogKeys` | **живий**: `storefront-routes/pages/home/queries.ts:2,66` | ЛИШИТИ |
| `createSupabase{Catalog,Order,Identity}…` | лише `src/engine-provider.tsx`, `src/server/engine.ts` | видалити разом зі споживачами |
| `createServerRuntime` (`src/server/engine.ts`) | **0** — лише визначення | видалити |
| `EngineContext.{catalog,orders,scope,identity,media}` | **0** поза адмінкою й контрактами | видалити з інтерфейсу |
| `EngineContext.config` | живий: `checkout-ui/CheckoutOrderSummary.tsx:31`, `CheckoutDeliveryForm.tsx:53`, `react-query/useFormatPrice.ts:28`, `admin/pages/ShippingZoneEdit.tsx:93` | ЛИШИТИ |
| `EngineContext.links` | живий лише у фікстурі тесту `react-query/__tests__/engine-provider.test.tsx:67` | ЛИШИТИ (host `appLinks` його постачає) |

---

### Task 1: Знести мертвий шар репозиторіїв

**Files:**
- Delete: `packages/simplycms/src/data-supabase/**` (увесь субшлях),
  `packages/simplycms/src/react-query/hooks.ts`,
  `packages/simplycms/src/react-query/__tests__/hooks.test.ts` (якщо є)
- Modify: `packages/simplycms/src/react-query/index.ts` (зняти `export * from './hooks'`),
  `packages/simplycms/src/react-query/queries.ts` (лишити `catalogKeys`, зняти
  `catalogQueries`/`orderQueries`/`orderKeys`),
  `packages/simplycms/src/react-query/__tests__/queries.test.ts` (звузити під `catalogKeys`),
  `packages/simplycms/package.json` (`exports` і `publishConfig.exports`:
  зняти `./data-supabase`),
  `packages/simplycms/tsup.config.ts` (зняти entry `data-supabase`),
  `eslint.tier-zones.mjs` + `tests/tier-boundary/zones.ts` (зняти зону `data-supabase`)

**Interfaces:**
- Produces: `simplycms/react-query` експортує лише `EngineProvider`,
  `useEngine`, `CartProvider`, `useCart`, `useFormatPrice`, `catalogKeys` і
  типи. Субшляху `simplycms/data-supabase` більше не існує.

- [ ] **Step 1:** довести, що шар мертвий (перед видаленням, щоб виконавець не видалив живе):

```bash
for h in useProduct useProducts useSections useProperties useStockInfo useOrder useOrders \
         catalogQueries orderQueries orderKeys; do
  echo "$h → $(rg -l "\b$h\b" -g '*.ts' -g '*.tsx' packages/simplycms/src src themes \
    | grep -v 'react-query/' | wc -l)"
done
```

Очікування: у кожного `0`. Якщо хоч в одного не 0 — СТОП, звіт власнику (щось приземлилось після аудиту).

- [ ] **Step 2:** видалити файли й почистити `index.ts`/`queries.ts` за списком Files. `catalogKeys` лишається — його споживає головна сторінка.
- [ ] **Step 3:** зняти `./data-supabase` з обох exports-мап, entry tsup, тір-зон.
- [ ] **Step 4:** `pnpm install` → повний ланцюг гейтів. Очікувані падіння, які треба полагодити тут же: `audit-exports` (зниклий субшлях), `test:packaging` (tarball-parity по exports).
- [ ] **Step 5:** Commit: `refactor(v2): знести мертвий шар репозиторіїв Supabase (нуль споживачів)`.

### Task 2: Звузити EngineContext і зняти Supabase з host-рушія

**Files:**
- Modify: `packages/simplycms/src/contracts/ports/index.ts:87-95` (інтерфейс
  `EngineContext`), `packages/simplycms/src/react-query/EngineProvider.tsx`
  (якщо валідує поля), `packages/simplycms/src/react-query/__tests__/engine-provider.test.tsx`
  (фікстура: лишити `config`+`links`), `src/engine-provider.tsx`,
  `src/engine.shared.ts`, `src/routes/__root.tsx` (якщо монтує
  `ClientEngineProvider` з клієнтом)
- Delete: `src/server/engine.ts` (`createServerRuntime` — нуль викликів)
- Modify (дзеркала, через `pnpm template:sync`): `packages/cli/host/src/**`,
  `packages/create-simplycms-store/template/src/**`; 🔴 якщо `src/server/engine.ts`
  зникає — зняти його і зі `SYNCED_FILES` у `scripts/sync-create-store-template.mjs`,
  інакше синк упаде на відсутньому файлі

**Interfaces:**
- Consumes: Task 1 (немає репозиторних портів).
- Produces: `EngineContext = { links: LinkResolver; config: ConfigProvider }`.
  `buildClientEngine()` більше не приймає Supabase-клієнт:
  `buildClientEngine(): EngineContext`.

- [ ] **Step 1 (RED):** оновити `react-query/__tests__/engine-provider.test.tsx` — фікстура містить лише `config` і `links`; тест на те, що `useEngine()` віддає їх. Прогнати: червоний (інтерфейс ще вимагає catalog/scope/identity/media).
- [ ] **Step 2:** звузити `EngineContext` до `{ links, config }`; прибрати з `contracts/ports` імпорти-сироти (`CatalogRepository`, `OrderRepository`, `IdentityProvider`, `ScopeResolver`, `MediaProvider`), якщо вони більше ніде не використовуються — інакше лишити типи, але зняти з інтерфейсу.
- [ ] **Step 3:** переписати `src/engine-provider.tsx`:

```tsx
// Збірка EngineContext. Supabase тут більше немає: репозиторії знесені
// (нуль споживачів), лишились лише конфіг магазину й резолвер посилань —
// обидва чисті, без IO.
import { useMemo, type ReactNode } from 'react';
import { EngineProvider } from 'simplycms/react-query';
import type { EngineContext } from 'simplycms/contracts';
import { appLinks, appConfig } from './engine.shared';

/** Збирає EngineContext магазину. Ізоморфний: жодного IO. */
export function buildClientEngine(): EngineContext {
  return { links: appLinks, config: appConfig };
}

export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => buildClientEngine(), []);
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}
```

- [ ] **Step 4:** почистити `src/engine.shared.ts`: зняти `createAppMediaProvider`, імпорт `SupabaseClient`, реекспорт `StoreDatabase` — якщо після Task 3 їх ніхто не споживає (перевірити `rg -n "createAppMediaProvider|StoreDatabase" src packages`). Видалити `src/server/engine.ts` і його рядок у `SYNCED_FILES`.
- [ ] **Step 5:** `pnpm template:sync`; повний ланцюг гейтів + `pnpm pilot:pack` (міняються host-файли — Gate A/C дивляться саме на них).
- [ ] **Step 6:** Commit: `refactor(v2): EngineContext звужено до config+links, host-рушій без Supabase`.

### Task 3: Зняти SupabaseProvider зі шляху вітрини

**Files:**
- Modify: `packages/simplycms/src/core/providers/CMSProvider.tsx:3,29,33`
  (прибрати `SupabaseProvider`), `packages/simplycms/src/core/index.ts`
  (реекспорт Supabase, якщо є)
- Test: `packages/simplycms/src/core/__tests__/cms-provider-no-supabase.test.tsx` (новий)

**Interfaces:**
- Consumes: Task 2.
- Produces: `CMSProvider` не монтує `SupabaseProvider`; рендер вітрини не
  торкається `resolveSupabaseKeys`, тож відсутність `VITE_SUPABASE_*` більше
  не кидає.

- [ ] **Step 1 (RED):** тест, що доводить саме поведінку, а не форму:

```tsx
// Гард регресії: рендер CMSProvider БЕЗ VITE_SUPABASE_* не повинен кидати.
// До фіксу падав на resolveSupabaseKeys усередині SupabaseProvider —
// саме це ламало вітрину в браузері (аудит 2026-08-24).
import { render, screen } from '@testing-library/react';
import { CMSProvider } from '../providers/CMSProvider';

it('рендериться без змінних Supabase', () => {
  const prev = { ...import.meta.env };
  delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_URL;
  delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_PUBLISHABLE_KEY;
  delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_ANON_KEY;
  try {
    render(<CMSProvider><span>вітрина</span></CMSProvider>);
    expect(screen.getByText('вітрина')).toBeInTheDocument();
  } finally {
    Object.assign(import.meta.env, prev);
  }
});
```

- [ ] **Step 2:** прогнати — червоний із текстом «Відсутні змінні оточення».
- [ ] **Step 3:** прибрати `<SupabaseProvider>` із `CMSProvider`; лишити решту провайдерів як є. Прогнати — зелений.
- [ ] **Step 4:** 🔴 **жива перевірка в браузері** (без неї задача не зроблена — саме цей клас дефекту curl не бачить). Підняти демо-БД і магазин БЕЗ `VITE_SUPABASE_*`, відкрити головну Playwright-ом і асертити нуль `console.error` і наявність `h1` з контентом. Було: «Щось пішло не так».
- [ ] **Step 5:** повний ланцюг гейтів. Commit: `fix(v2): вітрина не монтує SupabaseProvider — магазин працює без VITE_SUPABASE_*`.

### Task 4: AvatarUpload — гучна відмова замість тихої

**Files:**
- Modify: `packages/simplycms/src/profile-ui/AvatarUpload.tsx:3,44,70-82`
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/**` (новий ключ)
- Test: `packages/simplycms/src/profile-ui/__tests__/avatar-upload-disabled.test.tsx` (новий)

**Interfaces:**
- Consumes: Task 3 (клієнта Supabase у дереві більше немає).
- Produces: компонент рендериться, кнопка вибору файлу **disabled**, поруч —
  видиме пояснення; спроба завантаження неможлива. Жодного `useSupabaseClient`.

- [ ] **Step 1:** додати ключ `profile.avatar.unavailable` в обидва каталоги
      (`uk`: «Завантаження аватара тимчасово недоступне — сховище файлів
      підключається в наступному оновленні»; `en`: «Avatar upload is
      temporarily unavailable — file storage lands in an upcoming release»).
      🔴 Обидва каталоги обов'язково: `tests/i18n-catalog-parity.test.ts`
      червоніє на неповному `en`.
- [ ] **Step 2 (RED):** тест: рендер `AvatarUpload` показує текст ключа
      `profile.avatar.unavailable` і `input[type=file]` має `disabled`.
      Прогнати — червоний.
- [ ] **Step 3:** переписати компонент: зняти `useSupabaseClient` і весь
      блок `supabase.storage`; лишити показ поточного аватара, вимкнений
      інпут і пояснення. 🔴 Ніякого `onUpload`, що «нічого не робить, але не
      скаржиться» — це і є заборонена тиха заглушка.
- [ ] **Step 4:** прогнати тест — зелений; `pnpm lint` (i18n-зона — error).
- [ ] **Step 5:** повний ланцюг. Commit: `fix(profile): аватар — чесна відмова до контуру К4, без Supabase`.

### Task 5: `/api/health` на Postgres

**Files:**
- Modify: `packages/simplycms/routes/storefront/api/health.tsx` (повністю)
- Test: `packages/simplycms/test-harness/pg/__tests__/health-endpoint.test.ts` (новий)

**Interfaces:**
- Produces: `GET /api/health` → `200 {status:'healthy', checks:{database:{ok:true}}}`
  коли БД доступна; `503 {status:'degraded', …}` коли ні. Жодних
  Supabase-перевірок.

- [ ] **Step 1 (RED):** тест у схемному контурі: викликати хендлер проти
      живого харнеса — 200 і `checks.database.ok === true`; другим кейсом —
      з завідомо битим `DATABASE_URL` — 503. Прогнати: червоний.
- [ ] **Step 2:** переписати хендлер:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { withActor } from 'simplycms/db';
import { sql } from 'drizzle-orm';

/**
 * Health-ендпоінт магазину: пінг Postgres під роллю вітрини.
 *
 * 🔴 Перевіряє ТОЙ бекенд, на якому магазин працює. До 0.4.1 тут стояла
 * перевірка Supabase — у чистому V2-магазині вона давала 503 при повністю
 * робочому магазині, тобто healthcheck деплою (Dokploy) був би вічно
 * «unhealthy» (аудит 2026-08-24).
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        let ok = false;
        let error: string | null = null;
        try {
          await withActor({ role: 'app_user' }, (db) => db.execute(sql`select 1`));
          ok = true;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }
        return Response.json(
          {
            status: ok ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: { database: { ok, error } },
          },
          { status: ok ? 200 : 503 },
        );
      },
    },
  },
});
```

- [ ] **Step 3:** прогнати `pnpm test:schema` — зелений.
- [ ] **Step 4:** 🔴 жива перевірка: магазин проти демо-БД → `curl -s -o /dev/null -w '%{http_code}' localhost:PORT/api/health` = **200** (до фіксу було 503).
- [ ] **Step 5:** повний ланцюг + `test:schema`. Commit: `fix(health): пінг Postgres замість Supabase — healthcheck більше не бреше`.

### Task 6: Вичистити env-контракт усюди

**Files:**
- Modify: `.env.example` (зняти `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN` — лишити `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `VITE_SITE_URL`),
  `packages/create-simplycms-store/template/env.example` (лишити ті самі три),
  `src/vite-env.d.ts`, `simplycms.config.ts` + `template/simplycms.config.ts`,
  `supabase/config.toml` (якщо посилається на зняті ключі),
  `playwright.config.ts`
- Modify (тулінг, що ці ключі перевіряє): `packages/cli/src/doctor-checks.mjs`
  (🔴 `checkEnv` має гейтити `DATABASE_URL` і `BETTER_AUTH_SECRET` — те, що
  реально блокує старт, а не старий контракт), `packages/cli/src/doctor.mjs`,
  `packages/cli/src/doctor-online.mjs`, `packages/create-simplycms-store/src/scaffold.mjs`,
  `scripts/pilot-pack/{scaffold,tool-pkg-smoke,tool-doctor-smoke}.mjs`
- Modify (тести): `tests/create-store-cli.test.ts`, `tests/cli-pack.test.ts`,
  `tests/cli-doctor.test.ts`, `tests/create-store-invite-setup.test.ts`
- Modify: `packages/create-simplycms-store/src/steps.mjs:126` — замінити
  `supabase link --project-ref <ref> && supabase db push` на реальний шлях
  (README шаблону, рядок 46): `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`

**Interfaces:**
- Produces: env-контракт магазину = рівно `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `VITE_SITE_URL`. `simplycms doctor` перевіряє саме їх.

- [ ] **Step 1 (RED):** оновити `tests/cli-doctor.test.ts` — `checkEnv`
      червоніє на відсутньому `DATABASE_URL`/`BETTER_AUTH_SECRET` і НЕ
      згадує `VITE_SUPABASE_*`. Прогнати: червоний.
- [ ] **Step 2:** переписати `checkEnv` у `doctor-checks.mjs` під новий
      контракт; `doctor-online.mjs` — якщо він пінгував Supabase, перевести
      на `DATABASE_URL` або зняти з набору з явним поясненням у звіті doctor.
- [ ] **Step 3:** почистити обидва env-приклади, `vite-env.d.ts`, конфіги,
      `steps.mjs:126`; `pnpm template:sync`.
- [ ] **Step 4:** оновити решту тестів і пілотні скрипти зі списку Files.
- [ ] **Step 5:** 🔴 жива перевірка: скаффолд у чистій теці з локальних
      tarball-ів → в `.env.example` нема жодного `SUPABASE` →
      `pnpm simplycms doctor` без `DATABASE_URL` дає ПОМИЛКУ саме про нього.
- [ ] **Step 6:** повний ланцюг + `pnpm pilot:pack`. Commit: `chore(env): контракт магазину — DATABASE_URL/BETTER_AUTH_SECRET/VITE_SITE_URL, Supabase-ключі геть`.

### Task 7: Наскрізна жива перевірка «магазин із реєстру → Dokploy-поза»

**Files:** тільки перевірки, коду не змінює (крім фіксів, якщо щось спливе).

- [ ] **Step 1:** зібрати tarball-и (`pnpm build:packages` + `pnpm pack` кожного з 5) і скаффолднути магазин із них у чисту теку.
- [ ] **Step 2:** `.env.local` рівно з трьох ключів (жодного Supabase); накат канону README-способом на **чисту** БД; `pnpm build && pnpm start` під роллю `app_runtime`.
- [ ] **Step 3:** асертити: `/`, `/catalog`, `/cart`, `/auth`, `/sitemap.xml`, `/robots.txt` → 200; `/admin`, `/profile` анонімом → 307; **`/api/health` → 200**.
- [ ] **Step 4:** 🔴 браузером: нуль `console.error`, `h1` із реальним контентом (це головний доказ Task 3).
- [ ] **Step 5:** зафіксувати результат у `docs/tasks/v2-state-map.md` §2 (таблиця «доведено живим прогоном») і §5 (локальний запуск — прибрати згадку про потребу Supabase-ключів).
- [ ] **Step 6:** Commit: `docs(v2): карта стану — магазин без Supabase-ключів, доведено живим прогоном`.

### Task 8: Доки, роадмап, реліз 0.4.1

**Files:**
- Modify: `CLAUDE.md` (🔴 рядки 70/303/537-539 — К1′б пройдена, GoTrue знесено;
  розділ «Environment Variables» — новий контракт; Quick Reference),
  `docs/architecture/test-contours.md` (🔴 банер DECOMMISSIONED для
  `test:e2e`/`pilot:e2e` — §2/§3/§6/§9; борг К1а-8 це вже вимагав, але файл
  лишився без позначки), `docs/tasks/platform-roadmap.md` (К1а-3 → ✅ ЗАКРИТО
  2026-08-24 комітом 044bae9; нові борги),
  `packages/simplycms/src/supabase/README.md` і
  `packages/simplycms/src/auth/instance.ts:14` (шапки описують стан до К1′б),
  `.agents/skills/code-review/SKILL.md:156-159` (додати `test:schema` у
  канонічний порядок гейтів), `docs/architecture/cli.md:263`,
  `docs/architecture/plugins.md:152`, `docs/how-it-works.md:46`,
  `packages/cli/README.md:36`, `packages/cli/src/add-steps.mjs:31`,
  `packages/create-simplycms-store/README.md:71,89` (усі — `supabase db push`),
  `CHANGELOG.md`

- [ ] **Step 1:** синхронізувати доки за списком Files.
- [ ] **Step 2:** дописати в роадмап нові борги, знайдені аудитом і НЕ
      закриті цим планом: DoS на owner-invite, відсутній `profiles` у
      власника, витік `admin_comment`, ціни/доставка з клієнта, сліпота
      RLS-матриці на крос-акторний запис, відсутній Dockerfile, немає
      команди накату схеми, пароль `app_runtime` не автоматизований.
- [ ] **Step 3:** `pnpm template:sync`; повний ланцюг + `pnpm test:schema` + `pnpm pilot:pack`.
- [ ] **Step 4:** 🔴 закомітити ВСЕ (`git status` чистий — `release.mjs` має
      `assertCleanTree()` до бампу), далі `pnpm release 0.4.1`.
- [ ] **Step 5:** push, PR у `main`. 🔴 Мерж = публікація 0.4.1 — рішення власника.

## Поза цим планом (щоб виконавець не розширював скоуп)

- **Адмінка** (50 файлів, `useSupabaseClient`) і знесення
  `@supabase/supabase-js` із залежностей — трек К3.
- **Storage-порт** `delete`/`transform` + драйвери local-fs/s3 — К4
  (Task 4 лише робить відмову чесною).
- **Три дефекти безпеки** з аудиту (owner-invite DoS, `profiles` власника,
  `admin_comment`) — окремий короткий план; вони не пов'язані з Supabase і
  змішувати їх із цим контуром не варто.
- **Dockerfile / команда накату схеми / пароль `app_runtime`** — контур
  «деплой-пакет», окремо.
- **Розширення RLS-матриці** крос-акторним записом — окремо, у контурі гейтів.

## Верифікація (для окремого верифікаційного воркфлоу)

1. `rg -l "VITE_SUPABASE" -g '!node_modules' -g '!docs' .` — збіги лише в
   `packages/simplycms/src/{supabase,admin}/**` (шар, що чекає К3).
2. Магазин, зібраний БЕЗ `VITE_SUPABASE_*`: браузер — нуль `console.error`,
   контент на місці; `/api/health` — 200.
3. `simplycms doctor` без `DATABASE_URL` падає саме на ньому.
4. `pnpm pilot:pack` зелений; `test:schema` зелений.
5. `AvatarUpload` не має жодного шляху, який «успішно» нічого не зберігає.
6. Диф не містить змін у `packages/simplycms/src/admin/**`.
