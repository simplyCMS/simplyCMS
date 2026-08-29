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
- 🔴 **Гейти після КОЖНОЇ задачі** канонічним порядком (звірено з `AGENTS.md:39-41`):
  `pnpm install --frozen-lockfile → format:check → lint → build → typecheck
  → test → build:packages → typecheck:template → test:packaging`; після
  задач, що чіпають схему чи БД — додатково `pnpm test:schema`;
  `pnpm pilot:pack` — де позначено.
  🔴 `typecheck:template` — **окремий обов'язковий гейт**, не забудь:
  кореневий `tsconfig.json` виключає `template/`
  (`tooling.instructions.md:109`), тож правки host/шаблону кореневий
  `typecheck` НЕ бачить. Задачі 1 і 6 міняють саме цей контракт.
- 🔴 **`pnpm template:sync` після будь-якої правки host-файлів** (`src/*`):
  вони мають ТРИ дзеркала — `packages/cli/host/`, `template/` скаффолдера,
  і всі під parity-тестами.
- Локальний стенд для перевірок — memory `v2-local-test-stand`: контейнер
  `pgvector/pgvector:pg17` з `POSTGRES_HOST_AUTH_METHOD=trust` на порту
  55433, `PG_HARNESS_URL`/`db:demo`. 🔴 `grep` по збережених HTML сторінках
  бреше (файл містить `\0`) — використовуй `rg -a`.
- Коментарі українською; TS strict 5.9; файли ≤150 рядків; нові кириличні
  UI-рядки — лише через i18n-каталоги.
- Версія релізу — **0.4.1** (Task 7).

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

🔴 **Ревізія 3 (2026-08-24, два раунди аудиту Codex — 16 знахідок, усі
вивірені проти коду; плюс дві власні).** Раунд 2 дав ще два блокери:
(1) Task 1 не бачив `runtime/index.ts:64` і `engine-provider.test.tsx:13` —
без них `typecheck`/`test` не зазеленіли б; (2) порядок задач лишав
`/profile/settings` зламаним, бо `useSupabaseClient` має fallback на
`resolveDefaultClient()` (`SupabaseProvider.tsx:51`) — тому AvatarUpload
тепер ІДЕ ПЕРЕД зняттям провайдера. Решта раунду 2: прагма `jsdom` у
render-тестах (`vitest.config.ts:26` — `environment: 'node'`), реальні
пропси AvatarUpload і `Locale = 'uk' | 'en'`, `closeDbPool()` між кейсами
health-тесту й `connectionTimeoutMillis` у пулі, CLI-поверхня скаффолдера
(`--supabase-*` і промпт), доля `db:generate-types`, `.claude/settings.json`
свідомо НЕ чіпаємо, плюс `create-api-route.prompt.md`, `code-review/SKILL.md`,
`template/README.md` і кореневий `README.md` у списку доків.

**Раунд 1 (за тим самим аудитом):** Tasks 1 і 2 **злиті в одну атомарну задачу** — окремо вони
лишали репо в неробочому стані (видалення `src/data-supabase` при живих
імпортах `src/engine-provider.tsx:14` і `src/server/engine.ts:13`);
`typecheck:template` доданий у ланцюг гейтів; RED-кроки переписані під
реальні механізми (`pnpm typecheck` замість `pnpm test` там, де немає
рантайм-валідації; `vi.stubEnv` замість `delete import.meta.env`;
`I18nProvider` навколо компонента з `useT`); Task 4 отримав оновлення
Gate C і заборону віддавати сирий текст помилки БД; список доків Task 8
розширений канонічними інструкціями.

---

### Task 1: Атомарне знесення шару репозиторіїв + звуження EngineContext

🔴 **Ця задача атомарна за побудовою.** Видалити `src/data-supabase`
окремим комітом не можна: host (`src/engine-provider.tsx:14`,
`src/server/engine.ts:13`) імпортує його, і репо між комітами не
збереться. Знесення шару, звуження контракту й перепис host — один крок,
один зелений прогін гейтів.

**Files:**
- Delete: `packages/simplycms/src/data-supabase/**` (увесь субшлях),
  `packages/simplycms/src/react-query/hooks.ts` (+ його `__tests__`, якщо є),
  `src/server/engine.ts` (`createServerRuntime` — нуль викликів)
- Modify (ядро): `packages/simplycms/src/react-query/index.ts` (зняти
  `export * from './hooks'`), `.../react-query/queries.ts` (лишити
  `catalogKeys`, зняти `catalogQueries`/`orderQueries`/`orderKeys`),
  `.../react-query/__tests__/queries.test.ts`,
  `.../react-query/__tests__/engine-provider.test.tsx` (фікстура → `config`+`links`),
  `packages/simplycms/src/contracts/ports/index.ts:87-95` (інтерфейс `EngineContext`),
  `packages/simplycms/package.json` (`exports` І `publishConfig.exports`:
  зняти `./data-supabase`), `packages/simplycms/tsup.config.ts` (entry),
  `eslint.tier-zones.mjs` + `tests/tier-boundary/zones.ts` (зона `data-supabase`)
- 🔴 Modify (пропущені споживачі — без них `typecheck`/`test` не зазеленіють):
  `packages/simplycms/src/runtime/index.ts:64` — `defineRuntime` складає
  `EngineContext` із `adapters.catalog/orders/scope/identity/media`; звуження
  інтерфейсу ламає його компіляцію, тож `DefineRuntimeInput`/`adapters`
  звужуються ТУТ ЖЕ. `packages/simplycms/src/react-query/__tests__/engine-provider.test.tsx:13`
  імпортує `useProduct, useSections` із `../hooks`, який ця задача видаляє —
  тест переписується в тому ж кроці, інакше падає на імпорті.
- Modify (host): `src/engine-provider.tsx`, `src/engine.shared.ts`,
  `src/routes/__root.tsx` (якщо передає клієнт у `ClientEngineProvider`)
- Modify (синк): 🔴 `scripts/sync-create-store-template.mjs` — зняти
  `src/server/engine.ts` зі `SYNCED_FILES`, інакше `pnpm template:sync`
  упаде на відсутньому файлі; дзеркала `packages/cli/host/src/**` і
  `packages/create-simplycms-store/template/src/**` оновлює сам синк

**Interfaces:**
- Produces: `EngineContext = { links: LinkResolver; config: ConfigProvider }`;
  `buildClientEngine(): EngineContext` (без аргументів — Supabase-клієнта
  більше не приймає); `simplycms/react-query` експортує `EngineProvider`,
  `useEngine`, `CartProvider`, `useCart`, `useFormatPrice`, `catalogKeys` і типи.
  Субшляху `simplycms/data-supabase` не існує.

- [X] **Step 1:** довести, що шар мертвий (перед видаленням — щоб виконавець не зніс живе):

```bash
for h in useProduct useProducts useSections useProperties useStockInfo useOrder useOrders \
         catalogQueries orderQueries orderKeys createServerRuntime; do
  echo "$h → $(rg -l "\b$h\b" -g '*.ts' -g '*.tsx' packages/simplycms/src src themes \
    | grep -v 'react-query/\|src/server/engine.ts' | wc -l)"
done
```

Очікування: у кожного `0`. Якщо хоч в одного не 0 — СТОП, звіт власнику (щось приземлилось після аудиту 2026-08-24).

- [X] **Step 2 (RED):** звузити `EngineContext` у `contracts/ports/index.ts` до
      `{ links: LinkResolver; config: ConfigProvider }` і оновити фікстуру
      `react-query/__tests__/engine-provider.test.tsx` до тих самих двох полів.
      🔴 **RED тут — `pnpm typecheck`, а НЕ `pnpm test`**: `EngineProvider`
      (`react-query/EngineProvider.tsx:15`) не має рантайм-валідації — просто
      прокидає `value` у контекст, тож vitest лишиться зеленим і нічого не
      доведе. Червоніти має саме компілятор — на host-файлах, які ще
      передають `catalog`/`orders`/`scope`/`identity`/`media`.
- [X] **Step 3:** переписати `src/engine-provider.tsx`:

```tsx
// Збірка EngineContext. Supabase тут більше немає: репозиторії знесені
// (нуль споживачів — доведено Step 1), лишились конфіг магазину й резолвер
// посилань — обидва чисті, без IO.
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

- [X] **Step 3b:** 🔴 звузити `defineRuntime` (`runtime/index.ts:64`) і тип
      `DefineRuntimeInput` до `{ links, config }`; переписати
      `react-query/__tests__/engine-provider.test.tsx` (зняти імпорт
      `../hooks`, фікстура — два поля). Обидва — умова зеленого `typecheck`.
- [X] **Step 4:** видалити `src/data-supabase/**`, `react-query/hooks.ts`,
      `src/server/engine.ts`; почистити `react-query/index.ts` і `queries.ts`
      (🔴 `catalogKeys` ЛИШАЄТЬСЯ — його споживає
      `storefront-routes/pages/home/queries.ts:2,66`); почистити
      `src/engine.shared.ts` від `createAppMediaProvider`, імпорту
      `SupabaseClient` і реекспорту `StoreDatabase`, якщо після цього кроку
      їх ніхто не споживає (`rg -n "createAppMediaProvider|StoreDatabase" src packages`).
- [X] **Step 5:** зняти `./data-supabase` з ОБОХ exports-мап, entry tsup,
      тір-зон (`eslint.tier-zones.mjs` + `tests/tier-boundary/zones.ts`), і
      `src/server/engine.ts` зі `SYNCED_FILES`.
- [X] **Step 6:** `pnpm install --frozen-lockfile` → `pnpm template:sync` →
      повний ланцюг гейтів (включно з `typecheck:template`) + `pnpm pilot:pack`
      (міняються host-файли — на них дивляться Gate A/C).
      🔴 `test:packaging` при узгоджених правках exports+tsup має лишитись
      **зеленим**: `published-exports-parity` бере очікуване з
      `publishConfig.exports` динамічно (`tests/published-exports-parity.test.ts:59-63`).
      Якщо він червоніє — значить мапи розійшлись, це справжня помилка, а не
      очікуваний шум.
- [X] **Step 7:** Commit: `refactor(v2): знести мертвий шар репозиторіїв, EngineContext = config+links`.

### Task 2: AvatarUpload — гучна відмова замість тихої

🔴 **Іде ПЕРЕД зняттям `SupabaseProvider`, і це не стиль.**
`useSupabaseClient` має fallback на `resolveDefaultClient()`
(`SupabaseProvider.tsx:51`): якщо спершу зняти провайдер, `AvatarUpload`
(`ProfileSettings.tsx:225`) отримає не `null`, а виклик фабрики — і
`/profile/settings` упаде без Supabase-env. Перевірка головної сторінки
цього не ловить.

**Files:**
- Modify: `packages/simplycms/src/profile-ui/AvatarUpload.tsx:3,44,70-82`
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/**` (новий ключ)
- Test: `packages/simplycms/src/profile-ui/__tests__/avatar-upload-disabled.test.tsx` (новий)

**Interfaces:**
- Consumes: Task 1 (EngineContext уже звужений).
- Produces: компонент рендериться, інпут файлу **disabled**, поруч видиме
  пояснення; жодного `useSupabaseClient`. Пропси НЕ змінюються:
  `{ userId, currentAvatarUrl, firstName, lastName, email, onUpdate }`.

- [X] **Step 1:** додати ключ `profile.avatar.unavailable` в **обидва**
      каталоги (`uk`: «Завантаження аватара тимчасово недоступне — сховище
      файлів підключається в наступному оновленні»; `en`: «Avatar upload is
      temporarily unavailable — file storage lands in an upcoming release»).
      🔴 Обидва обов'язково: `tests/i18n-catalog-parity.test.ts` червоніє на
      неповному `en`.
- [X] **Step 2 (RED):** тест: рендер показує текст ключа й `input[type=file]`
      має `disabled`. 🔴 Три пастки, кожна дала б червоне з неправильної
      причини:
      (а) `vitest.config.ts:26` задає `environment: 'node'` — рендер без
      прагми впаде на відсутньому `document`; прецедент —
      `plugin-sdk/__tests__/usePluginT.test.tsx`;
      (б) `useT()` (`AvatarUpload.tsx:43`) кидає поза `<I18nProvider>`
      (`I18nProvider.tsx:43`);
      (в) `Locale = 'uk' | 'en'` (`i18n/types.ts:4`) — `"uk-UA"` не
      компілюється, а пропси компонента саме ті, що в Interfaces.

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { AvatarUpload } from '../AvatarUpload';

it('аватар недоступний до контуру К4 — інпут вимкнено, причина видима', () => {
  render(
    <I18nProvider locale="uk">
      <AvatarUpload
        userId="00000000-0000-0000-0000-000000000001"
        currentAvatarUrl={null}
        firstName="Тест"
        lastName="Тестенко"
        email="test@example.com"
        onUpdate={() => {}}
      />
    </I18nProvider>,
  );

  expect(
    screen.getByText(/тимчасово недоступне/i),
  ).toBeInTheDocument();
  expect(screen.getByTestId('avatar-file-input')).toBeDisabled();
});
```

- [X] **Step 3:** прогнати — червоний саме на відсутньому тексті/`disabled`.
- [X] **Step 4:** переписати компонент: зняти `useSupabaseClient` і весь блок
      `supabase.storage`; лишити показ поточного аватара, вимкнений інпут
      (`data-testid="avatar-file-input"`) і пояснення. 🔴 Ніякого `onUpload`,
      що «нічого не робить, але не скаржиться» — заборонена тиха заглушка
      (шапка файлу вже фіксує цей принцип, рядки 31-34).
- [X] **Step 5:** прогнати — зелений; `pnpm lint` (i18n-зона — error).
- [X] **Step 6:** повний ланцюг. Commit: `fix(profile): аватар — чесна відмова до контуру К4, без Supabase`.

### Task 3: Зняти SupabaseProvider зі шляху вітрини

**Files:**
- Modify: `packages/simplycms/src/core/providers/CMSProvider.tsx:3,29,33`
  (прибрати `SupabaseProvider`), `packages/simplycms/src/core/index.ts`
  (реекспорт Supabase, якщо є)
- Test: `packages/simplycms/src/core/__tests__/cms-provider-no-supabase.test.tsx` (новий)

**Interfaces:**
- Consumes: Task 2 (жоден компонент вітрини вже не кличе `useSupabaseClient`).
- Produces: `CMSProvider` не монтує `SupabaseProvider`; рендер вітрини не
  торкається `resolveSupabaseKeys`, тож відсутність `VITE_SUPABASE_*` більше
  не кидає.

- [X] **Step 1 (RED):** тест, що доводить поведінку, а не форму.
      🔴 `vi.stubEnv(..., undefined)`, **не** `delete import.meta.env.X`: у
      vitest `import.meta.env` — Proxy над `process.env`, і репо має
      канонічний обхід (`supabase/__tests__/env-source.test.ts:20-27`).
      🔴 Прагма `jsdom` обов'язкова (`vitest.config.ts:26` — `environment: 'node'`).

```tsx
// @vitest-environment jsdom
// Гард регресії: рендер CMSProvider БЕЗ VITE_SUPABASE_* не повинен кидати.
// До фіксу падав на resolveSupabaseKeys усередині SupabaseProvider — саме це
// ламало вітрину в браузері, тоді як SSR віддавав 200 (аудит 2026-08-24).
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CMSProvider } from '../providers/CMSProvider';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('рендериться без змінних Supabase', () => {
  vi.stubEnv('VITE_SUPABASE_URL', undefined);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', undefined);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);

  render(
    <CMSProvider>
      <span>вітрина</span>
    </CMSProvider>,
  );

  expect(screen.getByText('вітрина')).toBeInTheDocument();
});
```

- [X] **Step 2:** прогнати — червоний із текстом «Відсутні змінні оточення».
- [X] **Step 3:** прибрати `<SupabaseProvider>` із `CMSProvider`; решту провайдерів лишити. Прогнати — зелений.
- [X] **Step 4:** 🔴 **жива перевірка в браузері** (без неї задача не зроблена — цей клас дефекту curl не бачить). Магазин БЕЗ `VITE_SUPABASE_*`: відкрити Playwright-ом **головну І `/profile/settings`** (друга — доказ, що Task 2 відпрацювала), асертити нуль `console.error` і `h1` з контентом. Було: «Щось пішло не так».
- [X] **Step 5:** повний ланцюг гейтів. Commit: `fix(v2): вітрина не монтує SupabaseProvider — магазин працює без VITE_SUPABASE_*`.

### Task 4: `/api/health` на Postgres

**Files:**
- Modify: `packages/simplycms/routes/storefront/api/health.tsx` (повністю)
- Test: `packages/simplycms/test-harness/pg/__tests__/health-endpoint.test.ts` (новий)

**Interfaces:**
- Produces: `GET /api/health` → `200 {status:'healthy', checks:{database:{ok:true}}}`
  коли БД доступна; `503 {status:'degraded', …}` коли ні. Жодних
  Supabase-перевірок.

- [X] **Step 1 (RED):** тест у схемному контурі: викликати хендлер проти
      живого харнеса — 200 і `checks.database.ok === true`; другим кейсом —
      з завідомо битим `DATABASE_URL` — 503.
      🔴 Між кейсами **обов'язковий `await closeDbPool()`**
      (`db/client.ts:81`): пул — лінивий синглтон, і другий виклик віддає
      ВЖЕ створений (`client.ts:45-53` — це задокументована семантика
      «рестарт замість гарячої ротації», не баг). Без закриття негативний
      кейс говоритиме зі старою БД і 503 не доведе — тобто буде зеленим
      намарно. Прогнати: червоний.
- [X] **Step 2:** переписати хендлер:

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
        // 🔴 Назовні — стабільний рядок, а не err.message: текст помилки
        // драйвера містить hostname, роль і деталі зʼєднання, а health —
        // публічний неавтентифікований ендпоінт. Повна причина — у лог.
        if (error) console.error('[health] database check failed:', error);
        return Response.json(
          {
            status: ok ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: { database: { ok, error: ok ? null : 'database unavailable' } },
          },
          { status: ok ? 200 : 503 },
        );
      },
    },
  },
});
```

- [X] **Step 2b:** 🔴 додати `connectionTimeoutMillis` у фабрику пулу
      (`db/client.ts:71`). Зараз його немає: недоступний host підвисне до
      системного TCP-таймауту, і health замість своєчасного 503 просто не
      відповість — для Dokploy-healthcheck це гірше за 503, бо виглядає як
      зависання застосунку. Значення — 5000 мс (менше типового інтервалу
      healthcheck), винести константою з поясненням.
- [X] **Step 3:** 🔴 розширити bundle-guard пілота: у
      `scripts/pilot-pack/gate-c.mjs:23` масив `SERVER_PAYLOAD` перелічує
      лише `supabase/server-client`, `supabase/anon-client` і
      `storefront/loaders/` — після переходу health на `simplycms/db` гейт
      **фізично не здатен** побачити витік нового серверного графа. Додати:
      `/simplycms\/dist\/db/`, `/drizzle-orm/`, `/(^|[\/"'])pg([\/"']|$)/`.
      Без цього кроку задача не зроблена: у проєкті вже був випадок, коли
      серверний модуль поруч із serverFn затяг drizzle і пул Postgres у
      клієнтський бандл (спіймано саме Gate C).
- [X] **Step 4:** прогнати `pnpm test:schema` — зелений; `pnpm pilot:pack` —
      зелений із новим payload-guard.
- [X] **Step 5:** 🔴 жива перевірка: магазин проти демо-БД → `curl -s -o /dev/null -w '%{http_code}' localhost:PORT/api/health` = **200** (до фіксу було 503); тіло НЕ містить hostname чи назви ролі.
- [X] **Step 6:** повний ланцюг + `test:schema` + `pilot:pack`. Commit: `fix(health): пінг Postgres замість Supabase — healthcheck більше не бреше`.

### Task 4b: `guest-order` — легасі-шлях створення замовлення повз serverFn

**Files:**
- Modify або Delete: `packages/simplycms/routes/storefront/api/guest-order.tsx`
- Modify (якщо видаляємо): `src/routeTree.gen.ts` перегенерується `pnpm build` сам

**Контекст (знайдено при аудиті плану, 2026-08-24).** Це **другий** роут
вітрини на Supabase, крім health: HTTP-ендпоінт `POST /api/guest-order`
робить прямі `createServerSupabase()` → `.from('orders').insert(...)` →
`.from('order_items').insert(...)` (рядки 42, 50-51, 82-83). Він дублює
шлях, який у V2 уже робить serverFn `placeOrder`
(`storefront-routes/server/checkout.ts:30,44` → `createOrder`), і на новому
стеку мертвий (немає Supabase-env). Змонтований у роут-дереві, споживачів в
UI не має — коментар у файлі каже, що він «для зовнішніх клієнтів, не лише
React».

🔴 Значення не лише в Supabase: це паралельний шлях запису замовлень, який
**обходить весь новий контур** — валідацію, `withActor`, RLS і серверний
підрахунок підсумків. Лишати його «щоб не чіпати» не можна.

**Interfaces:**
- Produces: у вітрині лишається рівно ОДИН шлях створення замовлення —
  serverFn `placeOrder`.

- [X] **Step 1:** перевірити, що зовнішніх споживачів справді немає:
      `rg -n "api/guest-order" -g '!node_modules' -g '!*routeTree.gen.ts' .`
      Очікування: збіги лише в самому файлі й доках. Якщо знайдеться живий
      споживач — СТОП, рішення власника (порт на serverFn ≠ видалення).
- [X] **Step 2:** видалити файл (рекомендація: гостьовий чекаут уже
      покритий `placeOrder`, а RLS має гостьовий контур через
      `app.order_token`). Альтернатива, якщо власник хоче зберегти публічний
      HTTP-API: переписати хендлер на `placeOrder`-логіку через `withActor`
      — але тоді це окрема задача зі своїми тестами, не крок тут.
- [X] **Step 3:** `pnpm build` (перегенерує `routeTree.gen.ts`), повний
      ланцюг гейтів + `pnpm pilot:pack` (Gate A дивиться на роут-дерево).
- [X] **Step 4:** Commit: `refactor(v2): прибрати легасі-роут guest-order — дублює placeOrder і обходить новий контур`.

### Task 5: Вичистити env-контракт усюди

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
  `scripts/pilot-pack/{scaffold,tool-pkg-smoke,tool-doctor-smoke,e2e,gate-b,gate-e}.mjs`,
  `scripts/e2e.mjs`
- 🔴 Modify (**CLI-поверхня скаффолдера** — без неї команда й далі прийматиме
  Supabase-прапорці й питатиме ключі в кожного інтерактивного користувача):
  `packages/create-simplycms-store/src/args.mjs:50-56` (`--supabase-url`,
  `--supabase-key`), `.../src/steps.mjs:27` (інтерактивний промпт «URL проєкту
  Supabase»), `.../src/index.mjs:66` (прокидання цих опцій)
- 🔴 **НЕ чіпати** `.claude/settings.json:8`: там env для MCP
  `content-loader`, який винесений за скоуп плану. Прибрати звідти
  `SUPABASE_SERVICE_ROLE_KEY`, не переписавши `tools/content-loader-mcp/src/client.ts:4-5`,
  означало б зламати інструмент — суперечність, яку план не робить.
- 🔴 **Modify окремим кроком: `scripts/pilot-pack/env.mjs:24-26`** — див. Step 0

**🔴 Чому пілот тут головний (знайдено при аудиті плану):**
`resolvePilotEnv` (`scripts/pilot-pack/env.mjs:47`) у режимі `--pack-only`
підставляє скретч-магазину **фіктивні** ключі:

```js
const PLACEHOLDER_SUPABASE = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pilot_pack_placeholder',
};
```

Саме тому `pnpm pilot:pack` лишався зеленим, поки реальний магазин без цих
ключів падав у браузері: пілот **сам приховував дефект**, який цей реліз
лікує. Додатково — у пілоті **немає жодної згадки** `DATABASE_URL` чи
`BETTER_AUTH_SECRET`, тобто чинний env-контракт V2 він не вправляє взагалі
(`rg -n "DATABASE_URL|BETTER_AUTH" scripts/pilot-pack/*.mjs` → порожньо), хоч
Gate D піднімає справжній `node server.mjs` (`build.mjs:76`).
- Modify (тести): `tests/create-store-cli.test.ts`, `tests/cli-pack.test.ts`,
  `tests/cli-doctor.test.ts`, `tests/create-store-invite-setup.test.ts`
- Modify: `packages/create-simplycms-store/src/steps.mjs:126` — замінити
  `supabase link --project-ref <ref> && supabase db push` на реальний шлях
  (README шаблону, рядок 46): `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`

**Interfaces:**
- Produces: env-контракт магазину = рівно `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `VITE_SITE_URL`. `simplycms doctor` перевіряє саме їх.

- [X] **Step 0 (найважливіший):** зняти `PLACEHOLDER_SUPABASE` із
      `scripts/pilot-pack/env.mjs` і дати пілотові **чинний** контракт:
      `VITE_SITE_URL` + `DATABASE_URL` + `BETTER_AUTH_SECRET` (для
      `--pack-only` — синтаксично валідні значення, БД не потрібна, бо
      `vite build` запитів не робить; для режимів із БД — як і раніше з
      `.env.local`). 🔴 Без цього кроку пілот і після 0.4.1 продовжить
      сертифікувати магазин, зібраний із ключами, яких у продукті вже немає —
      тобто лишиться сліпим рівно до того класу регресії, який ми закриваємо.
      Прогнати `pnpm pilot:pack` — має лишитись зеленим уже БЕЗ жодного
      Supabase-ключа.
- [X] **Step 1 (RED):** оновити `tests/cli-doctor.test.ts` — `checkEnv`
      червоніє на відсутньому `DATABASE_URL`/`BETTER_AUTH_SECRET` і НЕ
      згадує `VITE_SUPABASE_*`. Прогнати: червоний.
- [X] **Step 2:** переписати `checkEnv` у `doctor-checks.mjs` під новий
      контракт; `doctor-online.mjs` — якщо він пінгував Supabase, перевести
      на `DATABASE_URL` або зняти з набору з явним поясненням у звіті doctor.
- [X] **Step 3:** почистити обидва env-приклади, `vite-env.d.ts`, конфіги,
      `steps.mjs:126`; `pnpm template:sync`.
- [X] **Step 4:** оновити решту тестів і пілотні скрипти зі списку Files.
- [X] **Step 4b:** 🔴 вирішити долю `pnpm db:generate-types`
      (`package.json:37` → `supabase/scripts/update-types.mjs:36-37`): вона
      читає `SUPABASE_PROJECT_ID`/`SUPABASE_ACCESS_TOKEN`, тобто після
      очищення env і доків матиме **прихований старий контракт**. За B12
      (типи з Drizzle) джерелом типів є `simplycms/schema/types` — тож
      рекомендація: **видалити** команду й скрипт разом із двома ключами.
      Якщо власник хоче лишити — команда й ключі мусять бути ЯВНО оголошені
      винятком у `.env.example` і в доках, а не мовчазним хвостом.
- [X] **Step 5:** 🔴 жива перевірка: скаффолд у чистій теці з локальних
      tarball-ів → в `.env.example` нема жодного `SUPABASE` →
      `pnpm simplycms doctor` без `DATABASE_URL` дає ПОМИЛКУ саме про нього.
- [X] **Step 6:** повний ланцюг + `pnpm pilot:pack`. Commit: `chore(env): контракт магазину — DATABASE_URL/BETTER_AUTH_SECRET/VITE_SITE_URL, Supabase-ключі геть`.

### Task 6: Наскрізна жива перевірка «магазин із реєстру → Dokploy-поза»

**Files:** тільки перевірки, коду не змінює (крім фіксів, якщо щось спливе).

- [X] **Step 1:** зібрати tarball-и (`pnpm build:packages` + `pnpm pack` кожного з 5) і скаффолднути магазин із них у чисту теку.
- [X] **Step 2:** `.env.local` рівно з трьох ключів (жодного Supabase); накат канону README-способом на **чисту** БД; `pnpm build && pnpm start` під роллю `app_runtime`.
- [X] **Step 3:** асертити: `/`, `/catalog`, `/cart`, `/auth`, `/sitemap.xml`, `/robots.txt` → 200; `/admin`, `/profile` анонімом → 307; **`/api/health` → 200**.
- [X] **Step 4:** 🔴 браузером: нуль `console.error`, `h1` із реальним контентом (це головний доказ Task 3).
- [X] **Step 5:** зафіксувати результат у `docs/tasks/v2-state-map.md` §2 (таблиця «доведено живим прогоном») і §5 (локальний запуск — прибрати згадку про потребу Supabase-ключів).
- [X] **Step 6:** Commit: `docs(v2): карта стану — магазин без Supabase-ключів, доведено живим прогоном`.

### Task 7: Доки, роадмап, реліз 0.4.1

**Files:**
- 🔴 **Канонічні інструкції — обов'язкові для наступних виконавців**, і після
  знесення шару вони наказуватимуть користуватися тим, чого немає:
  `.github/instructions/data-access.instructions.md:17,173` («нові data-шляхи
  будуй через `simplycms/data-supabase`»),
  `.github/instructions/architecture-core.instructions.md:33`,
  `AGENTS.md:99` (дерево з `src/data-supabase/`),
  `packages/README.md:35`,
  `packages/simplycms/src/react-query/README.md` (`catalogQueries`/`orderQueries`/`orderKeys`),
  `packages/simplycms/src/runtime/README.md` (`createServerRuntime`),
  `packages/simplycms/src/storefront/README.md`,
  `server.mjs` (коментар про ротацію Supabase-ключів),
  `.github/instructions/tooling.instructions.md`,
  🔴 `.github/prompts/create-api-route.prompt.md:18` (генерує Supabase-роути —
  наступні агенти діставатимуть хибний канон),
  🔴 `.agents/skills/code-review/SKILL.md:89` (вимагає перевіряти
  `data-supabase` і `SupabaseProvider`, яких уже немає)
- 🔴 Modify (**публікована документація** — без неї фінальний асерт
  верифікації не зійдеться):
  `packages/create-simplycms-store/template/README.md:33` (досі вимагає
  `VITE_SUPABASE_URL`/`PUBLISHABLE_KEY` з Dashboard),
  кореневий `README.md:89` (`supabase db push`)
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

- [X] **Step 1:** синхронізувати доки за списком Files.
- [X] **Step 2:** дописати в роадмап нові борги, знайдені аудитом і НЕ
      закриті цим планом: DoS на owner-invite, відсутній `profiles` у
      власника, витік `admin_comment`, ціни/доставка з клієнта, сліпота
      RLS-матриці на крос-акторний запис, відсутній Dockerfile, немає
      команди накату схеми, пароль `app_runtime` не автоматизований.
- [X] **Step 3:** `pnpm template:sync`; повний ланцюг + `pnpm test:schema` + `pnpm pilot:pack`.
- [ ] **Step 4:** 🔴 закомітити ВСЕ (`git status` чистий — `release.mjs` має
      `assertCleanTree()` до бампу), далі `pnpm release 0.4.1`.
- [ ] **Step 5:** push, PR у `main`. 🔴 Мерж = публікація 0.4.1 — рішення власника.

## Поза цим планом (щоб виконавець не розширював скоуп)

- **`tools/content-loader-mcp/src/client.ts`** — окремий MCP-інструмент, що
  читає `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (`client.ts:4-5`). Це не
  частина магазину й не входить у реліз-потяг; його доля — окреме рішення
  власника (він згадувався як кандидат на переробку).

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
   Окремо: `rg -ln "createServerSupabase|createAnonSupabase" packages/simplycms/routes`
   — **порожньо** (обидва роути-споживачі закриті Task 5 і 5b).
2. Магазин, зібраний БЕЗ `VITE_SUPABASE_*`: браузер — нуль `console.error`,
   контент на місці; `/api/health` — 200.
3. `simplycms doctor` без `DATABASE_URL` падає саме на ньому.
4. `pnpm pilot:pack` зелений — і 🔴 `rg -n "SUPABASE" scripts/pilot-pack/`
   порожньо: пілот більше не підставляє фіктивних ключів, тобто гейт нарешті
   вправляє той самий контракт, що й реальний магазин.
   `test:schema` зелений.
5. `AvatarUpload` не має жодного шляху, який «успішно» нічого не зберігає.
6. Диф не містить змін у `packages/simplycms/src/admin/**`.
