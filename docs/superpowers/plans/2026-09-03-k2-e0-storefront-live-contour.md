# К2-Е0 «Санація живого контуру вітрини» + борги треку T — план імплементації (ред. 1.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити чотири патерни дефектів, доведені живим прогоном (гейт-текст
замість поведінки; N копій доменного правила; стан не в тій фазі рендеру;
список декларації без контролю) — так, щоб демо-магазин із `pnpm db:demo`
проходив картку → кошик → чекаут → рядок в `orders` без помилок консолі, з
валідним sitemap і правдивим бейджем наявності; і щоб гейти межі
клієнт/сервер червоніли на вимкненому захисті й на усіченому списку.

**Architecture:** Дві хвилі одним планом. Хвиля 0 (Tasks 1–5) — борги треку T:
один читач `importProtection()` замість трьох копій блоку + DATA-тест;
мутаційний крок Import Protection у пілоті й `pilot:pack` у CI; сентинели дерев
у `dist-server-boundary`; типізація конфігів; §12 без чисел. Хвиля 1
(Tasks 6–15) — К2-Е0: контракт дат «`Date` у застосунку, текст лише на межі
виводу» (`mode: 'date'`); `isPurchasable` у домені як єдине правило + write-side
декремент під `decrease_on_order` через scoped-ескалацію ролі в тій самій
транзакції; `placeOrder` → union з серверним розрахунком цін і доставки;
кошик на `useSyncExternalStore`; покупний демо-сід; `scripts/live-smoke.mjs`
як DoD.

**Tech Stack:** TanStack Start 1.167 (Import Protection, `createServerFn`),
React 19 (`useSyncExternalStore`, `hydrateRoot`), Drizzle 0.45 + `pg`
(`mode: 'date'`, pool `options`), Zod 4, vitest 4 + jsdom, `@playwright/test`
1.61, Postgres 17 (харнес `test-harness/pg`), pnpm 11.20.

**Spec:** [`docs/superpowers/specs/2026-09-03-k2-e0-storefront-live-contour-design.md`](../specs/2026-09-03-k2-e0-storefront-live-contour-design.md)
(рішення T-1…T-5, Е0-1…Е0-8; рішення власника — Додаток А; відкинуті
альтернативи з доказами — Додаток Б). Читати ОБИДВА документи.

> 🔴 **Ред. 1.1 (2026-09-03) — після Codex-аудиту r1** (`gpt-5.6-sol`, reasoning
> high, read-only, HEAD `4f48286`; вердикт REJECT: 5 блокерів, 5 major, 3 minor —
> усі підтверджені проти коду). Що змінено: **(B1)** сентинел дерева `storefront`
> — `Disallow: /admin/` (`storefront/seo/robots.ts`), бо `[simplycms] Sign-in
> required` живе ще й у трьох клієнтських `core/lib/*`; преflight унікальності —
> крок Task 3; **(B2)** `priceCheckoutItems` дзеркалить `getDiscountEnvironment`
> (`core/lib/discounts.ts`): дефолтні тип ціни й категорія, `loadDiscountGroups(db,
> priceTypeId)`, `loadUserCategoryId` з `./categories`; **(B3)** `placeOrderFor` —
> ОДНА транзакція (валідація, ціни, отримувач, запис); **(B4)** демо-сід і
> харнес: `on conflict (code) do nothing` у фікстурах, showcase рахує точки з
> демо-точкою; **(B5)** `id`/`htmlFor` у полях контактної форми, селектори
> live-smoke — по них; **(M6)** чекліст споживачів дат із конкретними файлами;
> **(M7)** pickup — за `method.code === 'pickup'`, `null`-тариф →
> `shipping_unavailable`; **(M8)** ескалація повертає роль лише на success-path
> (в aborted-транзакції `set local role` дав би `25P02` і замаскував причину);
> **(M9)** `startStore`/`pnpm build` у live-smoke з явним env (shell не
> перекриває тестову БД); **(M10)** конкурентний anti-oversell кейс; **(m11)**
> мілісекундна точність задокументована; **(m12)** cleanup live-smoke у одному
> `try/finally`; **(m13)** `contracts/README.md`. Власна знахідка при верифікації:
> `shipping_rates.zone_id NOT NULL` — сід і фікстури заводять зону; пін сіду — 20.

## Global Constraints

Діють у кожній задачі; у кроках не повторюються.

- **Без зворотної сумісності й перехідних шимів** (рамка V2/К0/К3): клієнтів
  і реальних магазинів немає; критерій — вартість експлуатації, не ціна
  переписування.
- **Без нових абстракцій поверх наявних; максимальне перевикористання**:
  `useSyncExternalStore`-патерн `plugins/HookRegistry.ts`; `domain/inventory`
  як єдине місце правила наявності; result-union як у
  `storefront-routes/server/profile-orders.ts` (`OrderCancelResult`);
  `resolveShippingRate`/`resolvePrice`/`resolveDiscount` з домену на сервері;
  `mode: 'date'` з `schema/auth.ts`; харнес `test-harness/pg` + `fixtures/`;
  `scripts/pilot-pack/report.mjs::step`; `gate-b.mjs` для live-smoke.
- **Коментарі в коді — українською, пояснюють ПРИЧИНУ** (🔴 для
  неочевидного), не переказують код (`coding-style.instructions.md`).
- **Порядок гейтів** (CLAUDE.md): `pnpm install --frozen-lockfile →
  format:check → lint → build → typecheck → test → test:schema →
  build:packages → typecheck:template → test:packaging`; у релізі ще
  `pilot:pack`.
- **Мінімальний гейт кожної задачі перед комітом:** `pnpm format:check &&
  pnpm lint && pnpm test`. Задачі з харнесом — ще `pnpm test:schema`
  (потрібен Postgres: `docker start simplycms-review-pg` →
  `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`, або
  ефемерний `initdb`). Задачі з `dist` — ще `pnpm build:packages && pnpm
  test:packaging`; Task 4 — ще `pnpm pilot:pack`.
- **`pnpm lint` = 0 errors / 12 warnings — норма**; новий error — червоне.
- **Контракт id:** кожен INSERT у 41 таблицю «Категорії A» передає `id`
  явно (`randomUUID()` на сервері; статичні UUID у сідах).
- **Контракт серверного env:** серверний код читає ЛИШЕ `process.env` і лише
  в рантаймі; `import.meta.env` — тільки клієнт.
- **Контракт ключів кешу:** сегмент 0 `queryKey` — з `simplycms/contracts/entities`.
- **i18n:** новий рядок інтерфейсу — ключ в ОБОХ каталогах (`uk` і `en`;
  парність стереже `tests/i18n-catalog-parity.test.ts`); кирилиця в JSX —
  помилка лінту.
- **Кожен коміт** — двома трейлерами атрибуції сесії-виконавця, дослівно:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` і
  `Claude-Session: https://claude.ai/code/session_<id сесії-виконавця>`.
  Команди `git commit` нижче показують лише тіло; перевірка —
  `git show -s --format=%B HEAD | tail -2`.
- **`$SCRATCH`** — scratchpad сесії-виконавця; у репо тимчасові файли не
  кладуться. Робота — у гілці `claude/k2-e0-storefront-live-contour` від
  `main` (після мержу `claude/track-t-tsdown`). Прямі коміти в `main`
  заборонені — мерж публікує пакети на npm.
- **Робоче дерево після кожного кроку з мутацією — чисте** (`git status
  --porcelain` порожній), окрім файлів, які крок навмисно змінює.

---

## Мапа файлів

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `scripts/pilot-pack/gate-ip.mjs` | Мутаційний гейт: роут-витік (bare і відносний) валить `vite build` скретча з `[import-protection]`; чистий ре-білд після |
| `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx` | Гідраційний негативний контроль: `renderToString` → jsdom → `hydrateRoot` з передзаповненим `localStorage`, нуль recoverable errors |
| `packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts` | `DateStyle`/`TimeZone` сесії детерміновані пулом |
| `packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts` | Декремент залишку при замовленні, переворот статусу, відмова при нестачі |
| `packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts` | Кошик → `placeOrder`-логіка → рядок в `orders`; три доменні відмови |
| `packages/simplycms/src/storefront/loaders/checkout-items.ts` | Серверне читання позицій чекауту: назви, статуси, секції, ціни за id |
| `packages/simplycms/src/storefront/loaders/place-order.ts` | `placeOrderFor` — уся логіка оформлення (валідація, ціни, доставка, запис) у server-only дереві; serverFn лишається тонким |
| `tests/env-contract.test.ts` | Пін контракту env: `.env.example` ↔ `doctor-checks.mjs` |
| `scripts/live-smoke.mjs` | DoD як скрипт: curl+SQL (через `gate-b.mjs`) + Playwright (кошик, бейдж, воронка) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/src/contracts/server-only.ts`, `contracts/README.md` | три хелпери → `importProtection()`; рядок README (T-1) |
| `vite.config.ts`, `packages/create-simplycms-store/template/vite.config.ts`, `tests/pilot/store-template/vite.config.ts` | один рядок `importProtection: importProtection(),`; `import.meta.dirname`; розширення `.ts` (T-1, T-4) |
| `tests/import-protection-wiring.test.ts` | DATA-тест + анкерований рядок (T-1) |
| `scripts/pilot-pack/run.mjs`, `scripts/pilot-pack/build.mjs` | крок Gate IP наприкінці (T-2); `startStore(storeDir, port, extraEnv)` (Е0-8) |
| `.github/workflows/workflow.yml` | крок `pnpm pilot:pack` у job `packaging`; коментар про пілот (T-2) |
| `tests/dist-server-boundary.test.ts` | `SENTINELS` (T-3) |
| `packages/create-simplycms-store/template/tsconfig.json`, `tsconfig.template.json` | `vite.config.ts` в `include` (T-4) |
| `vitest.config.ts` | `import.meta.dirname` (T-4) |
| `docs/architecture/test-contours.md` §12 | структурні твердження (T-5, Task 15) |
| `CLAUDE.md` | `pilot:pack` у CI; env-тексти; `db:demo` покупний; `live:smoke` |
| `packages/simplycms/src/db/client.ts` | `options` пулу (Е0-2) |
| `packages/simplycms/src/schema/schema.ts`, `schema/media.ts` | `mode: 'string'` → `mode: 'date'` (Е0-2) |
| `packages/simplycms/src/storefront/seo/sitemap.ts`, `loaders/sitemap.ts`, `seo/__tests__/sitemap.test.ts`, `test-harness/pg/__tests__/storefront-loaders.test.ts` | `Date` + `toISOString()` на межі; чесні тести (Е0-2) |
| `packages/simplycms/src/storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx` | `formatDate(date: Date)` (Е0-2) |
| `.github/instructions/data-access.instructions.md` | розділ «Контракт дат» (Е0-2) |
| `packages/simplycms/src/domain/inventory.ts`, `domain/__tests__/inventory.test.ts` | `isPurchasable`, `schemaOrgAvailability` (Е0-3) |
| `packages/simplycms/src/storefront/loaders/{stock-info,stock,catalog-products}.ts` | споживачі правила (Е0-3) |
| `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx` | JSON-LD через `schemaOrgAvailability` (Е0-3) |
| `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront-client.ts`, `storefront-client-queries.test.ts` | фікстура `tryfazny` → `out_of_stock` (Е0-3) |
| `packages/simplycms/src/storefront/loaders/db.ts` | `OperatorEscalation` у `withCustomerDb`/`withOrderTokenDb` (Е0-3) |
| `packages/simplycms/src/storefront/loaders/order-create.ts` | `reserveStock`, `InsufficientStockError`, `loadStockManagement` (Е0-3) |
| `packages/simplycms/src/storefront-routes/server/{checkout,checkout-input}.ts` | union, серверні ціни/доставка, валідація (Е0-4) |
| `packages/simplycms/src/storefront/loaders/pricing.ts` | `loadPricesByProduct` (Е0-4) |
| `packages/simplycms/src/storefront-routes/pages/Checkout.tsx` | мапа `reason → i18n`, нова форма запиту (Е0-4) |
| `packages/simplycms/src/checkout-ui/CheckoutDeliveryForm.tsx`, `CheckoutOrderSummary.tsx`, `CheckoutContactForm.tsx` | empty-state, `FormMessage`, `disabled`; `id`/`htmlFor` полів контактів (Е0-4) |
| `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts` | ключі `checkout.rejected.*`, `checkout.noShippingMethods.*` (Е0-4) |
| `packages/simplycms/src/react-query/useCart.tsx` | стор на `useSyncExternalStore` (Е0-5) |
| `.github/instructions/optimization.instructions.md:54` | рецепт гідратації (Е0-5) |
| `packages/simplycms/migrations/demo/demo-seed.sql`, `test-harness/pg/__tests__/seed-determinism.test.ts`, `test-harness/pg/__tests__/fixtures/{storefront-client,showcase}.ts`, `storefront-showcase.test.ts` | доставка/зона/точка/тариф/залишки; банери `NULL`; пін 15 → 20; фікстури `on conflict (code)`; лічильник точок (Е0-6) |
| `packages/simplycms/src/storefront/loaders/entities/home-product.ts`, `loaders/home.ts`, `loaders/home-sections.ts`, `storefront-routes/pages/home/{types,toCardViewModel}.ts` | ціна на головній (Е0-6) |
| `.env.example`, `docs/tasks/v2-state-map.md` §2 | env-тексти; датований прогін (Е0-7, Е0-8) |
| `package.json` | скрипт `live:smoke` (Е0-8) |

**Видаляються:** нічого (три старі хелпери декларації зникають усередині T-1).

---
## Хвиля 0 — борги треку T

### Task 1: `importProtection()` — один читач замість трьох копій (T-1)

**Files:**
- Modify: `packages/simplycms/src/contracts/server-only.ts:100-146`
- Modify: `vite.config.ts:5-11, 38-60`
- Modify: `packages/create-simplycms-store/template/vite.config.ts:5-9, 35-59`
- Modify: `tests/pilot/store-template/vite.config.ts` (той самий блок, що в шаблоні; парність — `tests/create-store-template-parity.test.ts`)
- Modify: `packages/simplycms/src/contracts/README.md:30` (рядок про `server-only`)
- Test: `tests/import-protection-wiring.test.ts` (переписати)

**Interfaces:**
- Produces: `importProtection(): ImportProtectionOptions` з
  `simplycms/contracts/server-only` — повний обʼєкт опції Start; тип —
  `NonNullable<NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']>`.
  Старі `serverOnlySpecifiers`/`serverOnlyFiles`/`serverOnlyExcludeFiles`
  стають НЕекспортованими (читачів поза трьома конфігами — нуль; перевірено
  `git grep`).
- Consumes: `SERVER_ONLY`, `SERVER_ONLY_DEPS`, `serverOnlyDepSpecifier` (той самий файл).

- [ ] **Step 1: Переписати wiring-тест — спершу червоний**

Замінити вміст `tests/import-protection-wiring.test.ts` на:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importProtection } from 'simplycms/contracts/server-only';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Гейт підключення Import Protection (трек T; переписаний К2-Е0, T-1).
 *
 * 🔴 Попередня версія перевіряла ТЕКСТ трьох конфігів неанкерованими
 * регексами — і зеленіла на закоментованому блоці та на `enabled: false`
 * (штатна опція Start, яка вимикає плагін цілком). Тепер дві половини:
 *   1. ДАНІ — сам обʼєкт, який конфіги передають плагіну, перевіряється
 *      викликом хелпера декларації, а не читанням файлу;
 *   2. ТЕКСТ — рівно один анкерований рядок на конфіг: конфіг передає саме
 *      цей обʼєкт і не має поруч `enabled:`.
 * Поведінку (що збірка справді падає) доводить Gate IP пілота — `pnpm
 * pilot:pack`, у CI job `packaging`.
 */

const CONFIGS = [
  ['хост', 'vite.config.ts', './packages/simplycms/src/contracts/server-only'],
  [
    'шаблон магазину',
    'packages/create-simplycms-store/template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
  [
    'оверлей пілота',
    'tests/pilot/store-template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
] as const;

describe('Import Protection: дані декларації', () => {
  const options = importProtection();

  it('режим error, усі імпортери, жодного enabled', () => {
    expect(options.behavior).toBe('error');
    expect(options.include).toEqual(['**']);
    // 🔴 Відсутність ключа, а не `enabled !== false`: `enabled: undefined`
    // теж читається плагіном як «увімкнено», але ключ у обʼєкті — сигнал,
    // що хтось уже торкався перемикача.
    expect('enabled' in options).toBe(false);
  });

  it('client: три набори, і files несе дефолт Start вручну', () => {
    const client = options.client!;
    expect(client.specifiers!.length).toBeGreaterThanOrEqual(2);
    expect(client.files).toContain('**/*.server.*');
    expect(client.files!.length).toBe(2);
    expect(client.excludeFiles!.length).toBe(1);
  });

  it('specifiers ловлять server-only субшляхи й серверні залежності, пускають клієнтське', () => {
    const rx = (client: NonNullable<typeof options.client>) =>
      client.specifiers!.filter((p): p is RegExp => p instanceof RegExp);
    const denied = (s: string) => rx(options.client!).some((r) => r.test(s));
    expect(denied('simplycms/db')).toBe(true);
    expect(denied('simplycms/storefront/loaders')).toBe(true);
    expect(denied('simplycms/admin-server/impl')).toBe(true);
    expect(denied('better-auth')).toBe(true);
    expect(denied('better-auth/reactor')).toBe(true);
    expect(denied('better-auth/react')).toBe(false);
    expect(denied('simplycms/ui')).toBe(false);
    expect(denied('simplycms/admin-server')).toBe(false);
  });

  it('files ловлять server-only дерева і в src, і в dist; excludeFiles пускає лише ядро з node_modules', () => {
    const files = options.client!.files!.filter(
      (p): p is RegExp => p instanceof RegExp,
    );
    const deniedFile = (s: string) => files.some((r) => r.test(s));
    expect(deniedFile('packages/simplycms/src/db/index.ts')).toBe(true);
    expect(
      deniedFile(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/dist/auth/index.js',
      ),
    ).toBe(true);
    expect(deniedFile('packages/simplycms/src/ui/button.tsx')).toBe(false);
    expect(deniedFile('packages/simplycms-theme-solarstore/src/index.ts')).toBe(false);

    const [exclude] = options.client!.excludeFiles as RegExp[];
    expect(exclude.test('node_modules/react/index.js')).toBe(true);
    expect(
      exclude.test(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/src/db/client.ts',
      ),
    ).toBe(false);
  });
});

describe.each(CONFIGS)('Import Protection у конфізі: %s', (_l, file, specifier) => {
  const source = readFileSync(join(REPO, file), 'utf8');

  it('імпортує рівно хелпер importProtection з декларації', () => {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(source).toMatch(
      new RegExp(`^import \\{ importProtection \\} from '${escaped}';$`, 'm'),
    );
  });

  it('передає обʼєкт декларації одним анкерованим рядком і не чіпає enabled', () => {
    // 🔴 Анкер `^\s*` — щоб `// importProtection: …` (закоментований) не
    // рахувався; `enabled:` у будь-якій формі — червоне.
    expect(source).toMatch(/^\s*importProtection: importProtection\(\),$/m);
    expect(source).not.toMatch(/^\s*enabled\s*:/m);
  });
});
```

- [ ] **Step 2: Запустити — має впасти на імпорті `importProtection`**

Run: `pnpm vitest run tests/import-protection-wiring.test.ts`
Expected: FAIL — `importProtection` is not exported / not a function.

- [ ] **Step 3: Замінити три хелпери одним у декларації**

У `packages/simplycms/src/contracts/server-only.ts` рядки 100–146 (три
експортовані хелпери з докблоками) замінити на:

```ts
import type { tanstackStart } from '@tanstack/react-start/plugin/vite';

/** Форма опції `importProtection` плагіна Start — з його ж сигнатури. */
export type ImportProtectionOptions = NonNullable<
  NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']
>;

/**
 * Читач 6 — Import Protection (Vite-плагін Start), КЛІЄНТСЬКЕ середовище.
 * Повний обʼєкт опції, який три `vite.config.ts` (хост, шаблон магазину,
 * оверлей пілота) передають плагіну ОДНИМ рядком. Складати його на місці
 * означало б три копії, які розходяться, — і саме така копія колись дала
 * гейт, що зеленів на `enabled: false`.
 *
 * 🔴 Три пастки Start, усі виміряні (2026-09-02):
 *   • за замовчуванням перевіряються лише імпортери в `src/` — тому
 *     `include: ['**']`: теми, плагіни й сам пакет ядра в node_modules
 *     інакше поза перевіркою;
 *   • `specifiers` ловлять bare-імпорт у магазині, але в монорепо alias
 *     `simplycms/*` резолвить специфікатор РАНІШЕ за перевірку — тому поруч
 *     є `files` по резолвленому шляху; форма `simplycms/(src|dist)` покриває
 *     і `packages/simplycms/src/…`, і `node_modules/simplycms/src/…`
 *     (`src` їде в tarball), а сторонні `simplycms-*` не чіпає (дефіс);
 *   • `files` і `excludeFiles` дефолт Start ЗАМІЩУЮТЬ (`pick(user,
 *     default)`), а `specifiers` — зливаються. Тому `'**/*.server.*'`
 *     дописано вручну (інакше конвенція Start мовчки зникла б у кожному
 *     магазині), а дефолтний `'**/node_modules/**'` замінено лукахедом, що
 *     виключає все в node_modules, КРІМ пакета ядра: сторонній плагін чи
 *     тема мають `simplycms` у залежностях, pnpm кладе симлінк на ядро
 *     ПОРУЧ (`node_modules/.pnpm/simplycms@x/node_modules/simplycms/src/…`),
 *     і відносний шлях звідти в `simplycms/src/db` обійшов би `specifiers`,
 *     а наш лінт чужого коду не бачить. Слеш у `simplycms/` обовʼязковий —
 *     `simplycms-theme-*` лишаються виключеними.
 *
 * `behavior: 'error'` для dev і build — рішення власника 2026-09-02.
 * Ключа `enabled` тут немає навмисно: його наявність у будь-якому конфізі —
 * червоне для `tests/import-protection-wiring.test.ts`.
 */
export const importProtection = (): ImportProtectionOptions => ({
  behavior: 'error',
  include: ['**'],
  client: {
    specifiers: [
      new RegExp(`^simplycms/(${alternation})(/|$)`),
      ...SERVER_ONLY_DEPS.map(serverOnlyDepSpecifier),
    ],
    files: [
      new RegExp(`simplycms/(src|dist)/(${alternation})(/|\\.[tj]sx?$)`),
      '**/*.server.*',
    ],
    excludeFiles: [/^(?!.*node_modules\/simplycms\/).*node_modules\//],
  },
});
```

Імпорт типу поставити у верх файлу (перший рядок — `import type …`); решта
файлу без змін. 🔴 `import type` з peer-пакета в T0 не додає рантайм-залежності
— це і є межа «лише дані».

- [ ] **Step 4: Три конфіги — один рядок**

У кожному з трьох `vite.config.ts` замінити імпорт трьох хелперів на
`import { importProtection } from '<той самий специфікатор>';` (хост —
`'./packages/simplycms/src/contracts/server-only'`, шаблон і оверлей —
`'simplycms/contracts/server-only'`), а блок `importProtection: { … }` (від
`importProtection: {` до відповідної `},`) разом із коментарем над ним — на:

```ts
        // 🔴 Межа довіри клієнт/сервер у САМІЙ збірці магазину: Start валить
        // збірку (dev і build) з трасою імпорту. Обʼєкт опції — з єдиної
        // декларації ядра (там же пояснено три пастки Start); тут — один
        // рядок, і гейт `tests/import-protection-wiring.test.ts` стереже,
        // що він саме такий і без `enabled:` поруч.
        importProtection: importProtection(),
```

У оверлеї пілота — той самий блок (він побайтово збігається з шаблонним
поза `#region pilot-only`; парність асертить
`tests/create-store-template-parity.test.ts`).

- [ ] **Step 4а: README контрактів**

У `packages/simplycms/src/contracts/README.md:30` фрагмент «і три набори патернів
Import Protection магазину — `serverOnlySpecifiers()`, `serverOnlyFiles()`,
`serverOnlyExcludeFiles()`» → «і `importProtection()` — повний обʼєкт опції
Import Protection Start (читач 6), який три `vite.config.ts` передають одним
рядком».

- [ ] **Step 5: Зелено**

Run: `pnpm vitest run tests/import-protection-wiring.test.ts tests/create-store-template-parity.test.ts`
Expected: PASS (усі кейси обох файлів).

- [ ] **Step 6: Негативний контроль руками — обидва обходи тепер червоні**

```bash
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1\/\/ importProtection: importProtection(),/' vite.config.ts
pnpm vitest run tests/import-protection-wiring.test.ts 2>&1 | grep -E "✓|✗|×|passed|failed" | tail -4
git checkout -- vite.config.ts
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1importProtection: { enabled: false, ...importProtection() },/' vite.config.ts
pnpm vitest run tests/import-protection-wiring.test.ts 2>&1 | grep -E "passed|failed" | tail -2
git checkout -- vite.config.ts
git status --porcelain
```

Expected: обидва прогони — `failed` (перший — на анкерованому рядку, другий —
на `enabled:`); дерево після — чисте.

- [ ] **Step 7: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
git add packages/simplycms/src/contracts/server-only.ts packages/simplycms/src/contracts/README.md vite.config.ts packages/create-simplycms-store/template/vite.config.ts tests/pilot/store-template/vite.config.ts tests/import-protection-wiring.test.ts
git commit -m "test(k2-e0): Import Protection — один читач importProtection() і DATA-гейт замість тексту

Три копії блоку в vite.config.ts злито в хелпер декларації; тест перевіряє
дані (behavior, include, три набори, відсутність enabled) і один анкерований
рядок на конфіг. Закоментований блок і enabled:false тепер червоні (T-1)."
```

---

### Task 2: Типізація конфігів і `import.meta.dirname` (T-4)

**Files:**
- Modify: `packages/create-simplycms-store/template/tsconfig.json:22`
- Modify: `tsconfig.template.json` (блок `include`)
- Modify: `vitest.config.ts:3-5`
- Modify: `vite.config.ts:4, 11, 20, 67-79`
- Test: `tests/template-typecheck-coverage.test.ts` (існує; сам почервоніє без пари)

**Interfaces:** нічого не продукує; споживає Task 1 (рядок `importProtection` у
конфізі шаблону тепер типізується проти `dist`).

- [ ] **Step 1: Додати `vite.config.ts` у include шаблону — coverage-тест червоніє**

У `packages/create-simplycms-store/template/tsconfig.json` рядок
`"include": ["src", "routes.ts", "simplycms.config.ts"],` →
`"include": ["src", "routes.ts", "simplycms.config.ts", "vite.config.ts"],`.

Run: `pnpm vitest run tests/template-typecheck-coverage.test.ts`
Expected: FAIL — `uncovered: ["packages/create-simplycms-store/template/vite.config.ts"]`.

- [ ] **Step 2: Пара в `tsconfig.template.json`**

У блок `include` додати рядок
`"packages/create-simplycms-store/template/vite.config.ts",` (після
`…/simplycms.config.ts`). Над блоком — коментар:

```jsonc
  // 🔴 `vite.config.ts` шаблону — у програмі: трек T поклав у нього
  // типізований виклик декларації межі, а поза `include` він не типізувався
  // НІДЕ (кореневий tsconfig шаблон виключає) — та сама діра, що колись у
  // `routes.ts`. Пару в `template/tsconfig.json` стереже
  // `tests/template-typecheck-coverage.test.ts`.
```

Run: `pnpm vitest run tests/template-typecheck-coverage.test.ts && pnpm build:packages && pnpm typecheck:template`
Expected: PASS; `tsc -p tsconfig.template.json` — без помилок.

- [ ] **Step 3: Негативний контроль типізації шаблону**

```bash
sed -i "s/server: { entry: '.\/server.ts' },/server: { entry: 42 },/" packages/create-simplycms-store/template/vite.config.ts
pnpm typecheck:template 2>&1 | grep -c "error TS"
git checkout -- packages/create-simplycms-store/template/vite.config.ts
```

Expected: лічильник ≥ 1 (TS2322 на `entry`); після відкату — дерево чисте.

- [ ] **Step 4: `import.meta.dirname` у двох кореневих конфігах + розширення**

`vitest.config.ts`: `const pkg = (p: string) => resolve(__dirname, 'packages', p);` →
`const pkg = (p: string) => resolve(import.meta.dirname, 'packages', p);`; так
само `resolve(__dirname, 'packages/simplycms/src')` і два `resolve(__dirname,
'themes'|'plugins')` → `import.meta.dirname`.

`vite.config.ts`: усі `__dirname` (рядки 20, 67, 71, 75-77) → `import.meta.dirname`;
рядок 11 імпорту декларації —
`from './packages/simplycms/src/contracts/server-only.ts';` (Vite попереджає
про імпорт без розширення під `configLoader: 'native'`).

🔴 Причина в коментарі над першим `import.meta.dirname` у `vite.config.ts`:

```ts
// `import.meta.dirname`, не `__dirname`: конфіг — ESM у пакеті з
// `"type": "module"`; Vite попереджає про `__dirname` під майбутнім
// дефолтом `configLoader: 'native'`, а прямий імпорт конфігу в тестах
// падав саме на ньому (`ReferenceError: __dirname is not defined`).
```

Run: `pnpm build 2>&1 | grep -c "unsupported by \`configLoader: 'native'\`"; pnpm test 2>&1 | grep -c "unsupported by"`
Expected: `0` і `0`.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build && pnpm typecheck
git add packages/create-simplycms-store/template/tsconfig.json tsconfig.template.json vitest.config.ts vite.config.ts
git commit -m "build(k2-e0): vite.config.ts шаблону під typecheck:template; import.meta.dirname у кореневих конфігах

Шаблон типізується проти dist (негативний контроль — зіпсований тип entry
ловиться); coverage-тест вимагає пару include. Vite більше не попереджає про
__dirname і імпорт без розширення (T-4)."
```

---

### Task 3: Сентинели дерев у `dist-server-boundary` (T-3)

**Files:**
- Modify: `tests/dist-server-boundary.test.ts` (дописати блок після `describe`)

**Interfaces:**
- Consumes: `SERVER_ONLY`, `closure`, `distFiles`, `entryFiles()` (той самий файл).
- Produces: нічого зовнішнього.

- [ ] **Step 0: Преflight унікальності — літерал живе ЛИШЕ у своєму дереві**

🔴 Codex r1 спіймав: `[simplycms] Sign-in required` є ще й у трьох клієнтських
`core/lib/{review-form,user-addresses,user-recipients}.ts` — сентинел, що
доживає до клієнтського `dist`, червонить гейт завжди. Кожен кандидат перед
внесенням у мапу — через цей преflight (нуль файлів поза деревом, тести
виключені):

```bash
P=packages/simplycms/src
for pair in "db|[simplycms/db]" "auth|[simplycms/auth]" "schema|wishlists_own_all" \
  "storefront|Disallow: /admin/" "storefront-routes/seo|public, max-age=3600, stale-while-revalidate=86400" \
  "admin-server/impl|patch не може бути порожнім"; do
  tree=${pair%%|*}; lit=${pair#*|}
  n=$(grep -rlF -- "$lit" $P | grep -v __tests__ | grep -vc "^$P/$tree/")
  printf '%-24s %-52s поза деревом: %s\n' "$tree" "$lit" "$n"
done
```

Expected: `0` у кожному рядку (перевірено 2026-09-03 на HEAD `4f48286`).

- [ ] **Step 1: Написати блок сентинелів — спершу червоний на навмисно неповній мапі**

Дописати в кінець `tests/dist-server-boundary.test.ts`:

```ts
/**
 * Сентинели дерев — контроль САМОГО списку `SERVER_ONLY` (К2-Е0, T-3).
 *
 * 🔴 Усі шість читачів декларації похідні від списку: приберіть звідти
 * `'storefront'` — лоадери переїдуть у клієнтську групу збірки
 * (`tsdown.config.ts`), Import Protection і Gate C перестануть їх бачити,
 * а партиція вище лишиться зеленою, бо ітерує той самий усічений список.
 * Єдиний контроль, не похідний від списку, — літерал із ДЖЕРЕЛА кожного
 * дерева: він мусить (а) існувати в джерелі (інакше рефакторинг рядка
 * зробить сентинел порожнім мовчки), (б) бути в серверному замиканні
 * `dist`, (в) бути відсутнім у клієнтському. Мапа — свідома друга копія
 * списку: її ключі й `SERVER_ONLY` мусять збігатися.
 *
 * 🔴 Літерали — РЯДКИ коду, не ідентифікатори: клієнтська збірка магазину
 * мініфікує імена, а ці літерали в `dist` пакета лишаються дослівно.
 */
const SENTINELS: Record<(typeof SERVER_ONLY)[number], string> = {
  db: '[simplycms/db]',
  auth: '[simplycms/auth]',
  schema: 'wishlists_own_all',
  storefront: 'Disallow: /admin/',
  'storefront-routes/seo': 'public, max-age=3600, stale-while-revalidate=86400',
  'admin-server/impl': 'patch не може бути порожнім',
};

const SRC = resolve(CORE, 'src');

/** Усі `.ts`/`.tsx` під деревом джерел (без тестів). */
const sourceFilesOf = (tree: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(next);
      } else if (/\.tsx?$/.test(entry.name)) out.push(next);
    }
  };
  walk(resolve(SRC, tree));
  return out;
};

describe('сентинели server-only дерев (контроль списку декларації)', () => {
  it('мапа сентинелів покриває рівно список SERVER_ONLY', () => {
    expect(Object.keys(SENTINELS).sort()).toEqual([...SERVER_ONLY].sort());
  });

  it.each(Object.entries(SENTINELS))(
    '%s: літерал є в джерелі дерева',
    (tree, literal) => {
      const hit = sourceFilesOf(tree).some((file) =>
        readFileSync(file, 'utf8').includes(literal),
      );
      expect(hit, `«${literal}» зник із packages/simplycms/src/${tree}`).toBe(true);
    },
  );

  it.each(Object.entries(SENTINELS))(
    '%s: літерал у серверному замиканні dist і відсутній у клієнтському',
    (_tree, literal) => {
      const entries = entryFiles();
      const server = closure(entries.filter((f) => isServerOnlySubpath(subpathOf(f))));
      const client = closure(entries.filter((f) => !isServerOnlySubpath(subpathOf(f))));
      const has = (set: Set<string>) =>
        [...set].some((f) => readFileSync(f, 'utf8').includes(literal));
      expect(has(server), `«${literal}» не знайдено в серверному dist`).toBe(true);
      expect(has(client), `«${literal}» ПРОТІК у клієнтський dist`).toBe(false);
    },
  );
});
```

🔴 `storefront → 'Disallow: /admin/'`: літерал живе в `storefront/seo/robots.ts`
(дерево `storefront`, entry `storefront/seo`) і ніде більше в `src` — тому саме
він, а не рядок із `loaders/session.ts`, який дублюють serverFn-модулі `core/lib`.

Додати в імпорти файлу `readdirSync` (з `node:fs`). 🔴 Перед запуском —
тимчасово прибрати з `SENTINELS` рядок `db:` (щоб побачити, що перший кейс
падає), запустити, повернути.

Run: `pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts`
Expected: з прибраним `db` — FAIL «мапа сентинелів…»; з повною мапою — PASS.

- [ ] **Step 2: Негативний контроль на усічення списку**

```bash
sed -i "s/^  'storefront',$/  \/\/ 'storefront',/" packages/simplycms/src/contracts/server-only.ts
pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts 2>&1 | grep -E "passed|failed" | tail -2
git checkout -- packages/simplycms/src/contracts/server-only.ts
pnpm build:packages
```

Expected: FAIL (щонайменше «мапа сентинелів…» і «Disallow: /admin/ ПРОТІК у
клієнтський dist»); після відкату й ре-білду — PASS.

- [ ] **Step 3: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:packaging
git add tests/dist-server-boundary.test.ts
git commit -m "test(k2-e0): сентинели server-only дерев — усічення SERVER_ONLY червонить packaging

Мапа літералів не похідна від списку: ключі = SERVER_ONLY, літерал є в
джерелі дерева, у серверному замиканні dist і відсутній у клієнтському.
Негативний контроль — закоментований 'storefront' валить гейт (T-3)."
```

---

### Task 4: Gate IP — мутаційний доказ межі в пілоті + `pilot:pack` у CI (T-2)

**Files:**
- Create: `scripts/pilot-pack/gate-ip.mjs`
- Modify: `scripts/pilot-pack/run.mjs:31-60`
- Modify: `.github/workflows/workflow.yml:127-130, 171-177`
- Modify: `CLAUDE.md` (рядок про `pilot:pack` у CI/CD-таблиці й у «Порядку гейтів»)

**Interfaces:**
- Produces: `gateImportProtection(storeDir): { ok: boolean; details: string[] }`.
- Consumes: `viteBuild(storeDir)` з `./build.mjs`; `step` з `./report.mjs`.

- [ ] **Step 1: Написати гейт**

`scripts/pilot-pack/gate-ip.mjs`:

```js
/**
 * Gate IP — Import Protection ВАЛИТЬ збірку магазину на витоку (К2-Е0, T-2).
 *
 * 🔴 Це поведінковий доказ межі клієнт/сервер у РЕАЛЬНОМУ магазині з
 * tarball-ів: юніт `tests/import-protection-wiring.test.ts` перевіряє дані
 * й підключення, а що плагін справді зупиняє збірку — лише прогін. Дві
 * форми витоку, бо їх ловлять РІЗНІ механізми плагіна:
 *   • bare `simplycms/db` — `specifiers`;
 *   • відносна втеча в `node_modules/simplycms/src/db/client` — `files` з
 *     нашим `excludeFiles` (дефолтний виключав би весь node_modules).
 *
 * 🔴 Експорт у відносній формі — РЕАЛЬНИЙ (`resolveDatabaseUrl`): з
 * вигаданим ім'ям Rolldown падає на `MISSING_EXPORT` РАНІШЕ за межу, і
 * червона збірка доводить не те (спіймано на рев'ю 2026-09-03).
 *
 * 🔴 Vite спорожнює `dist/` на старті збірки, тож після червоних збірок
 * скретч перезбирається начисто — інакше `--keep` лишив би порожній dist.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { viteBuild } from './build.mjs';

const LEAK_ROUTE = 'src/routes/my/__leak.tsx';
const MARKER = '[import-protection] Import denied';

const LEAKS = [
  {
    label: 'bare simplycms/db (specifiers)',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { withActor } from 'simplycms/db';
export const Route = createFileRoute('/my/__leak')({
  component: () => <div>{typeof withActor}</div>,
});
`,
  },
  {
    label: 'відносна втеча в node_modules/simplycms/src/db/client (files + excludeFiles)',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { resolveDatabaseUrl } from '../../../node_modules/simplycms/src/db/client';
export const Route = createFileRoute('/my/__leak')({
  component: () => <div>{typeof resolveDatabaseUrl}</div>,
});
`,
  },
];

/** `vite build`, який МУСИТЬ упасти; віддає stderr+stdout для пошуку маркера. */
function buildExpectingFailure(storeDir) {
  try {
    execFileSync(join(storeDir, 'node_modules/.bin/vite'), ['build'], {
      cwd: storeDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    });
    return { failed: false, output: '' };
  } catch (error) {
    return {
      failed: true,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

/**
 * @param {string} storeDir
 * @returns {{ ok: boolean; details: string[] }}
 */
export function gateImportProtection(storeDir) {
  const details = [];
  let ok = true;
  const routeFile = join(storeDir, LEAK_ROUTE);
  mkdirSync(join(storeDir, 'src/routes/my'), { recursive: true });

  try {
    for (const leak of LEAKS) {
      writeFileSync(routeFile, leak.source);
      const { failed, output } = buildExpectingFailure(storeDir);
      const denied = failed && output.includes(MARKER);
      // Червона збірка без маркера — це НЕ доказ межі, а інша поламка.
      const passed = denied;
      details.push(
        `${passed ? 'OK  ' : 'FAIL'} ${leak.label} — ${
          failed ? (denied ? 'збірка впала з маркером' : 'збірка впала БЕЗ маркера Import Protection') : 'збірка ПРОЙШЛА — витік не зупинено'
        }`,
      );
      if (!passed) ok = false;
    }
  } finally {
    rmSync(routeFile, { force: true });
    // Чистий ре-білд: Vite спорожнив dist на кожній червоній збірці.
    viteBuild(storeDir);
    details.push('OK   роут-витік прибрано, скретч перезібрано начисто');
  }
  return { ok, details };
}
```

- [ ] **Step 2: Крок у пілоті — наприкінці, після Gate B**

У `scripts/pilot-pack/run.mjs`: імпорт
`import { gateImportProtection } from './gate-ip.mjs';` і після рядка
`if (!opts.packOnly) results.push(await gateServer(opts));` (перед `return
results;`):

```js
  // 🔴 Останнім: кожна червона збірка спорожнює dist скретча, а Gate C/D і
  // Gate B читають його. Гейт сам перезбирає скретч наприкінці.
  step('Gate IP — Import Protection валить витік у збірці магазину');
  results.push(['IP', gateImportProtection(opts.storeDir)]);
```

Також у `scripts/pilot-pack.mjs::describeScope()` обидва рядки доповнити
`+ IP`: `'гейти A/C/D/IP + CLI/TOOL'` і `'гейти A-D/IP + CLI/TOOL (E знято)'`.

Run: `pnpm pilot:pack 2>&1 | tail -25`
Expected: `Gate IP: PASS` з двома `OK` і рядком про ре-білд; решта гейтів PASS.

- [ ] **Step 3: Негативний контроль гейта — вимкнений захист має дати FAIL**

```bash
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1importProtection: { enabled: false },/' packages/create-simplycms-store/template/vite.config.ts
pnpm template:sync >/dev/null 2>&1 || true
pnpm pilot:pack 2>&1 | grep -A3 "Gate IP"
git checkout -- packages/create-simplycms-store/template/vite.config.ts tests/pilot/store-template/vite.config.ts
git status --porcelain
```

Expected: `Gate IP: FAIL` з двома рядками «збірка ПРОЙШЛА — витік не зупинено»;
дерево після відкату чисте. (Якщо `template:sync` нічого не змінив — оверлей
пілота править той самий рядок вручну перед прогоном і відкочується так само.)

- [ ] **Step 4: `pilot:pack` у CI job `packaging` + коментар**

У `.github/workflows/workflow.yml` після кроку `Tarball parity`:

```yaml
      # 🔴 Пілот пакування БЕЗ бази (рішення власника 2026-09-03, К2-Е0 T-2):
      # єдиний поведінковий доказ межі клієнт/сервер у реальному магазині з
      # tarball-ів — Gate C (серверного вантажу немає в чанках) і Gate IP
      # (витік ВАЛИТЬ збірку). Детермінований; +≈1–2 хв на install скретча.
      - name: Pilot (pack-only)
        run: pnpm pilot:pack
```

Блок коментаря наприкінці файлу (рядки про «Пілот пакування … у CI НЕ
ганяється») переписати:

```yaml
# 🔴 `pnpm pilot` (Gate B проти живої БД) у CI НЕ ганяється — рішення власника
# (2026-08-01): зовнішній стан бази дрейфує без регресії коду. `pnpm
# pilot:pack` (без БД) у CI Є з 2026-09-03 — job `packaging` вище. Прогін
# `pilot` перед релізом — відповідальність розробника; команди — у CLAUDE.md.
```

У `CLAUDE.md`: у таблиці CI/CD рядок job `packaging` → кроки
`install → build:packages → typecheck:template → test:packaging → pilot:pack`; у
розділі «Порядок гейтів» речення «у CI він не ганяється» про `pilot:pack` →
«з 2026-09-03 ганяється і в CI (job `packaging`); `pilot` з Gate B — ні».

Run: `pnpm test` (тести читають `workflow.yml`: `template-typecheck-coverage`).
Expected: PASS.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test
git add scripts/pilot-pack/gate-ip.mjs scripts/pilot-pack/run.mjs scripts/pilot-pack.mjs .github/workflows/workflow.yml CLAUDE.md
git commit -m "test(k2-e0): Gate IP — витік валить збірку скретча; pilot:pack у CI

Мутаційний крок у пілоті: bare simplycms/db і відносна втеча в
node_modules/simplycms/src/db/client з реальним експортом мусять дати
[import-protection] Import denied; після — чистий ре-білд. pilot:pack — у job
packaging (рішення власника 2026-09-03; борг №2 звужено до pilot з Gate B)."
```

---

### Task 5: §12 `test-contours.md` — структурні твердження замість чисел (T-5)

**Files:**
- Modify: `docs/architecture/test-contours.md` §12 (рядки 661–850)

**Interfaces:** нічого; документує Tasks 1, 3, 4.

- [ ] **Step 1: Таблиця читачів + сьомий рядок; текст про пастки — у декларацію**

У таблиці «Читач | Що доводить | Негативний контроль» §12:
- рядок Import Protection → негативний контроль: «`tests/import-protection-wiring.test.ts` (дані + анкерований рядок; `enabled: false` — червоне) і **Gate IP** пілота (`pnpm pilot:pack`, у CI): bare `simplycms/db` і відносна втеча в `node_modules/simplycms/src/db/client` валять `vite build` скретча з `[import-protection]`»;
- новий сьомий рядок: «`tests/dist-server-boundary.test.ts`, блок сентинелів | контроль САМОГО списку `SERVER_ONLY`: мапа літералів не похідна від списку, кожен є в джерелі дерева, у серверному `dist` і відсутній у клієнтському | закоментований рядок `'storefront'` у декларації → червоний packaging».

Абзац «🔴 ТРИ пастки Import Protection» скоротити до одного речення з
посиланням: «Три пастки Start (include за замовчуванням лише `src/`; alias
резолвить раніше за `specifiers`; `files`/`excludeFiles` заміщують дефолт) —
задокументовані в докблоці `importProtection()` у `contracts/server-only.ts`
разом із моделлю загрози; тут не дублюються».

- [ ] **Step 2: Живий прогін і маркери — без чисел, що дрейфують**

У підрозділі «Живий прогін 2026-09-03»: замінити абзац «Межа в бою. Нуль
збігів по 20 маркерах … у ВСІХ 241 чанку …» і три таблиці маркерів
(«13 доказових», «4 слабкі», «3 без контролю») на:

> **Межа в бою.** Доказ — гейт, не таблиця: сентинел кожного server-only
> дерева (`tests/dist-server-boundary.test.ts`, блок `SENTINELS`) є в
> серверному `dist` і відсутній у клієнтському; у скретч-магазині Gate C
> не знаходить серверного вантажу, а Gate IP доводить, що витік валить
> збірку. Правило вибору маркера лишається чинним і задокументоване в
> тому ж тесті: клієнтська збірка мініфікує ІМЕНА, тож доказовий маркер —
> лише рядковий ЛІТЕРАЛ (ідентифікатор дає хибний нуль). Ручний перелік
> із 20 маркерів і його числа (перший вимір 2026-09-02, повторний
> 2026-09-03) — в історії git цього файлу; у чинному тексті їх немає
> навмисно (урок №8 роадмапу).

Абзаци «Правило вибору маркера…», «Методика цифр…», «Три хибні результати»
залишити (вони структурні), але прибрати з них числа файлів/рядків:
«216 файлів `dist/server` — це ≈89 000 рядків…» → «серверна збірка НЕ
мініфікована (читабельні імена, банери `#region`), клієнтська — мініфікована
з перейменуванням ідентифікаторів; на це вказує різниця в кількості рядків
на два порядки при майже тому самому обсязі байтів»; таблицю
«ідентифікатор проти співмодульного літерала» лишити як ілюстрацію з
приміткою «числа — вимір на дату, не контракт».

Рядок про розмір `dist/client/assets` → «Дельта `sideEffects: false` —
−1 228 байтів (відтворюється між збірками; абсолютний розмір — ні)».

- [ ] **Step 3: Коміт**

```bash
pnpm format:check
git add docs/architecture/test-contours.md
git commit -m "docs(k2-e0): §12 — доказ межі як гейт (сентинели, Gate IP), числа — лише порядок величини

Таблиця читачів отримала сьомий рядок (контроль списку); три пастки Start —
у докблоці декларації; ручні таблиці маркерів і лічильники знято з чинного
тексту (урок №8) (T-5)."
```

---
## Хвиля 1 — К2-Е0

### Task 6: Спайк — `Date` через `createServerFn` і loader (Е0-1)

**Files:**
- Тимчасово (видаляються в цій же задачі): `src/routes/my/__date-spike.tsx`
- Нічого в репо не лишається; результат — один абзац у DoD-коментарі Task 7.

**Interfaces:**
- Produces: висновок «A» (Date доїжджає як `Date`) або «B» (приїжджає рядком) — визначає крок 6 Task 7.

- [ ] **Step 1: Тимчасовий роут із loader-ом і serverFn, що віддають `Date`**

`src/routes/my/__date-spike.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

// ТИМЧАСОВИЙ спайк К2-Е0 (Task 6): чи доїжджає Date через межу serverFn і
// через loader-payload SSR. Видаляється в цій же задачі.
const getStamp = createServerFn({ method: 'GET' }).handler(async () => ({
  at: new Date('2026-07-01T00:00:00.000Z'),
}));

export const Route = createFileRoute('/my/__date-spike')({
  loader: () => getStamp(),
  component: () => {
    const data = Route.useLoaderData();
    const kind = data.at instanceof Date ? 'Date' : typeof data.at;
    return <pre data-kind={kind}>{`${kind}:${String(data.at)}`}</pre>;
  },
});
```

- [ ] **Step 2: Збірка, запуск, дві перевірки (SSR-розмітка і serverFn)**

```bash
pnpm build >/dev/null && (PORT=3199 node server.mjs > "$SCRATCH/spike.log" 2>&1 &) && sleep 3
curl -s http://127.0.0.1:3199/my/__date-spike | grep -ao 'data-kind="[A-Za-z]*"'
ID=$(grep -rhoE '"[0-9a-f]{64}"' dist/client/assets/*date-spike*.js dist/client/assets/*__date-spike*.js 2>/dev/null | head -1 | tr -d '"')
curl -s -H 'x-tsr-serverFn: true' "http://127.0.0.1:3199/_serverFn/$ID" | head -c 300; echo
pkill -f "PORT=3199" ; rm src/routes/my/__date-spike.tsx; git status --porcelain
```

Expected «A»: `data-kind="Date"` у SSR-розмітці І у клієнтському DOM після
гідратації (перевірити в браузері або `node -e` з Playwright:
`page.locator('pre').getAttribute('data-kind')` → `Date`); відповідь serverFn
містить seroval-теґ дати (обʼєкт з `t:` і рядком ISO), не голий рядок.
Expected «B»: `data-kind="string"`.
Дерево після — чисте (роут видалено, `src/routeTree.gen.ts` регенерується
наступним `pnpm build`; якщо він у диффі — `git checkout -- src/routeTree.gen.ts`).

- [ ] **Step 3: Зафіксувати висновок**

Нічого не комітити. Результат («A» чи «B») передати в Task 7 крок 6.

---

### Task 7: Контракт дат — `Date` у застосунку, текст лише на межі (Е0-2)

**Files:**
- Modify: `packages/simplycms/src/db/client.ts:81-85`
- Modify: `packages/simplycms/src/schema/schema.ts` (62 колонки), `packages/simplycms/src/schema/media.ts:52`
- Modify: `packages/simplycms/src/storefront/loaders/sitemap.ts:14-30`, `packages/simplycms/src/storefront/seo/sitemap.ts:51-64`
- Modify: `packages/simplycms/src/storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx` (функція `formatDate`)
- Test: `packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`, `packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts:192-193`
- Create: `packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`
- Modify: `.github/instructions/data-access.instructions.md` (новий розділ «Контракт дат»)

**Interfaces:**
- Produces: усі `createdAt`/`updatedAt` доменної схеми — `Date` (тип виводиться `InferSelectModel`); `SitemapSection.updated_at: Date`, `SitemapProduct.updated_at: Date`; `entry(loc, lastmod?: Date, …)` у `seo/sitemap.ts`.
- Consumes: результат Task 6.

- [ ] **Step 1: Юніт sitemap — фікстури `Date`, асерт W3C — спершу червоний**

У `packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`:
`DATA` → `updated_at: new Date('2026-07-01T00:00:00Z')` (і решта дві дати так
само); кейс `'lastmod береться з рядка БД'` замінити на:

```ts
  it('lastmod — W3C Datetime (toISOString), а не текст драйвера', () => {
    // 🔴 sitemaps.org вимагає W3C Datetime; текст Postgres
    // (`2026-07-01 00:00:00+00`) роботи відкидають. Межа виводу — єдине
    // місце, де Date стає рядком.
    expect(xml).toContain('<lastmod>2026-07-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-07-02T00:00:00.000Z</lastmod>');
    for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      expect(m[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });
```

У кейсі «спецсимволи» — `updated_at: new Date('2026-07-02T00:00:00Z')`.

Run: `pnpm vitest run packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`
Expected: FAIL (TS: `Date` не присвоюється `string`; або рантайм — `<lastmod>` з `toString()` дати).

- [ ] **Step 2: Пул — детерміновані `DateStyle`/`TimeZone`**

У `packages/simplycms/src/db/client.ts` в `new pg.Pool({ … })`:

```ts
  pool ??= new pg.Pool({
    connectionString: resolveDatabaseUrl(process.env),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    // 🔴 Текст, яким драйвер віддає timestamptz, — властивість КЛАСТЕРА
    // (GUC DateStyle/TimeZone), не коду: під `SQL,DMY` `new Date()` у V8
    // читає `01/07/2026` як 7 січня. Startup-опції роблять його
    // детермінованим для кожного зʼєднання пулу; парсер дат Drizzle
    // (`mode: 'date'`) далі працює з передбачуваним входом. Гейт —
    // test-harness/pg/__tests__/db-session-options.test.ts.
    options: '-c DateStyle=ISO,YMD -c TimeZone=UTC',
  });
```

- [ ] **Step 3: Харнес-тест сесійних опцій**

`packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`:

```ts
// Детермінованість текстового формату дат — властивість пулу, не кластера
// (К2-Е0, Е0-2). Без startup-опцій формат залежав би від DateStyle/TimeZone
// того Postgres, де живе магазин.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { withStorefrontDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import { withUser } from '../apply.mjs';

describe('пул: DateStyle/TimeZone зʼєднання', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
    process.env.DATABASE_URL = withUser(harness.url, 'app_runtime');
  }, 60_000);

  afterAll(async () => {
    await closeDbPool();
    await harness.teardown();
  });

  it('кожне зʼєднання пулу — ISO, YMD і UTC незалежно від дефолтів кластера', async () => {
    const rows = await withStorefrontDb(async (db) => {
      const style = await db.execute(sql`show DateStyle`);
      const tz = await db.execute(sql`show TimeZone`);
      return { style: style.rows[0], tz: tz.rows[0] };
    });
    expect(rows.style).toEqual({ DateStyle: 'ISO, YMD' });
    expect(rows.tz).toEqual({ TimeZone: 'UTC' });
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`
Expected: PASS. (🔴 Запускати лише з `--config vitest.schema.config.ts` —
кореневий конфіг харнес виключає й дасть «No test files found».)

- [ ] **Step 4: Схема — `mode: 'date'` на 62 + 1 колонках**

```bash
sed -i "s/mode: 'string'/mode: 'date'/g" packages/simplycms/src/schema/schema.ts packages/simplycms/src/schema/media.ts
grep -c "mode: 'date'" packages/simplycms/src/schema/schema.ts   # очікувано 62
grep -c "mode: 'string'" packages/simplycms/src/schema/schema.ts packages/simplycms/src/schema/media.ts   # очікувано 0 і 0
```

У шапку `schema.ts` (докблок рядків 1–45) додати абзац:

```ts
 * 🔴 Контракт дат (К2-Е0, Е0-2): усі timestamp — `mode: 'date'`, як у
 * `./auth.ts`. `mode: 'string'` віддавав не ISO, а сирий текст Postgres
 * (`drizzle-orm/node-postgres` підкладає identity-парсер для timestamptz), і
 * він доїжджав до `<lastmod>` sitemap і в браузер. У застосунку дата — `Date`;
 * рядком вона стає лише на межі виводу (`toISOString()` у sitemap, `Intl` в
 * UI). DDL від `mode` не залежить — `db:diff` порожній.
```

Run: `pnpm db:diff k2e0-check 2>&1 | tail -3` (очікувано — «без змін»/порожній
diff; якщо утиліта створила порожній файл міграції — видалити його) і `pnpm
typecheck 2>&1 | grep -c "error TS"` — це **список споживачів** для кроку 5.

- [ ] **Step 5: Споживачі — тип `Date`, форматування на межі**

За списком `pnpm typecheck` (очікувані місця; правило одне — тип стає `Date`,
конверсія в рядок лише там, де рядок виходить назовні):

1. `storefront/loaders/sitemap.ts`: `readonly updated_at: Date;` в обох
   інтерфейсах.
2. `storefront/seo/sitemap.ts`: `function entry(loc: string, lastmod?: Date, …)`
   і `if (lastmod) parts.push(\`    <lastmod>${lastmod.toISOString()}</lastmod>\`);`
   — 🔴 з коментарем: «Єдине місце, де дата стає рядком: W3C Datetime для
   sitemaps.org; текст драйвера роботи відкидають».
3. `contracts/objects/*.ts` — поля `created_at`/`updated_at`, типізовані
   `string`, що заповнюються з рядків схеми (напр. `ShippingMethod`,
   `PickupPoint`, `Order`, `Review`): → `Date`. Не додавати `String(...)`.
4. `storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx`:
   `const formatDate = (date: Date) => new Intl.DateTimeFormat('uk-UA', {…}).format(date);`
   (без `new Date(dateString)`).
5. `admin-server/impl/**`, `admin-data/**` — типи рядків із `simplycms/schema/types`
   стають `Date` автоматично; де є `expect(...).toEqual(expect.any(String))` на
   датах у тестах — `expect.any(Date)`.
6. Будь-який `new Date(row.created_at)` у `packages/simplycms/src` — прибрати
   обгортку (значення вже `Date`): `grep -rn "new Date(.*\(created_at\|updated_at\)" packages/simplycms/src`
   (відомий: `storefront/loaders/entities/banner.ts:79`).
7. 🔴 ЗАПИСИ ISO-рядків у Date-колонки — тепер помилка типу, бо колонка чекає
   `Date`: `storefront/loaders/profile.ts:72`, `storefront/loaders/orders.ts:111`,
   `plugin-sdk/server/config-db.ts:52` — передавати `new Date()`. Пошук:
   `grep -rn "toISOString()" packages/simplycms/src --include='*.ts' | grep -v seo/sitemap`.
8. Ручні контракти з датами-рядками: `contracts/objects/discount.ts:31`
   (`starts_at`/`ends_at` тощо) → `Date | null`; домен `resolveDiscount`
   порівнює дати — звірити, що він приймає `Date` (або `new Date(x)` всередині).
9. 🔴 Моки колекцій адмінки повертають РЯДКИ там, де serverFn віддасть `Date`:
   `admin-data/__tests__/order-statuses-collection.test.ts:15,89` — фікстури
   `created_at: new Date(…)` і асерти `toBeInstanceOf(Date)`; колекція без runtime-схеми
   (`admin-data/collections/order-statuses.ts:19`) типізується з `schema/types`
   автоматично. `admin/pages/OrderStatuses.tsx:104` — legacy `supabase-js` на
   замороженому `database.ts`, НЕ чіпати.
10. Точність: `Date` — мілісекунди; мікросекунди Postgres (`.331961`) відкидаються
    (`pg-core/columns/timestamp.js:30` → `new Date(value)`). Місць, де це
    критично, не знайдено (аудит r1) — зафіксувати в докблоці `schema.ts` (крок 4)
    і в розділі «Контракт дат» (крок 8) одним реченням.

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Межа serverFn — за результатом Task 6**

«A» (Date доїжджає): нічого не робити; у докблок `schema.ts` (крок 4) дописати
«Через `createServerFn` і loader-payload `Date` проходить як `Date`
(спайк К2-Е0 Task 6, seroval)».

«B» (приїжджає рядком): у `storefront-routes/server/*.ts` кожен serverFn, що
віддає рядки з датами, мапить їх на межі: `created_at: row.created_at.toISOString()`
з типом `string` у DTO serverFn (не у лоадерах — усередині сервера контракт
лишається `Date`); сторінки кабінету тоді форматують `new Date(iso)` з
коментарем «ISO з межі serverFn, не текст драйвера». Записати вибір гілки в
докблок `schema.ts`.

- [ ] **Step 7: Харнес: `updated_at` — `Date`, не «якийсь рядок»**

У `packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts:192-193`:

```ts
    // `updated_at` — Date (контракт К2-Е0): рядком він стає лише в
    // `<lastmod>` через toISOString(). Регекс ФОРМАТУ драйвера тут пінив би
    // GUC кластера, а не код.
    expect(data.products[0].updated_at).toBeInstanceOf(Date);
```

Run: `pnpm test:schema`
Expected: PASS (включно з новим `db-session-options`).

- [ ] **Step 8: Інструкція `data-access` — розділ «Контракт дат»**

У `.github/instructions/data-access.instructions.md` після розділу «Контракт id»
додати:

```markdown
## Контракт дат (К2-Е0, 2026-09-03)

Усі `timestamp` доменної схеми — `mode: 'date'`: у застосунку дата — `Date`.
Рядком вона стає ЛИШЕ на межі виводу, там, де формат диктує зовнішній контракт:
`toISOString()` у `storefront/seo/sitemap.ts` (W3C Datetime), `Intl.DateTimeFormat`
у UI. Пул `simplycms/db` ставить `DateStyle=ISO,YMD`/`TimeZone=UTC` на кожне
зʼєднання — текст драйвера не залежить від кластера. 🔴 `new Date(рядок)` у
коді вітрини — сигнал, що межу перетнули не там. Гейти:
`seo/__tests__/sitemap.test.ts` (W3C-регекс), `test-harness/pg/__tests__/
storefront-loaders.test.ts` (`instanceof Date`), `db-session-options.test.ts`.
```

- [ ] **Step 9: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema
git add -A packages/simplycms/src packages/simplycms/test-harness .github/instructions/data-access.instructions.md
git commit -m "feat(k2-e0): контракт дат — Date у застосунку, текст лише на межі виводу

62+1 колонки схеми на mode:'date' (механізм із auth.ts; DDL без змін), пул із
DateStyle=ISO,YMD/TimeZone=UTC (гейт харнеса), <lastmod> через toISOString
(юніт із Date-фікстурами й W3C-регексом; лоадер — instanceof Date). Сторінки
кабінету форматують Date через Intl без парсингу тексту драйвера (Е0-2)."
```

---

### Task 8: Наявність — `isPurchasable` як єдине правило на читанні (Е0-3, read-side)

**Files:**
- Modify: `packages/simplycms/src/domain/inventory.ts`
- Modify: `packages/simplycms/src/storefront/loaders/stock-info.ts:82`, `stock.ts:96`, `catalog-products.ts:133-141`
- Modify: `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx:60-63`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront-client.ts`, `storefront-client-queries.test.ts:175`
- Test: `packages/simplycms/src/domain/__tests__/inventory.test.ts`

**Interfaces:**
- Produces: `isPurchasable(status: string | null | undefined): boolean`;
  `schemaOrgAvailability(status): 'https://schema.org/InStock' | 'https://schema.org/BackOrder' | 'https://schema.org/OutOfStock'`;
  `calculateProductAvailability(product: ProductAvailabilityInput): boolean` (другий параметр знято);
  `enrichProductsWithAvailability(products)` (другий параметр знято).
- Consumes: `StockStatus` з `simplycms/contracts`.

- [ ] **Step 1: Юніти домену — нові кейси, спершу червоні**

Замінити вміст `packages/simplycms/src/domain/__tests__/inventory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  calculateProductAvailability,
  enrichProductsWithAvailability,
  isPurchasable,
  schemaOrgAvailability,
} from '../inventory';
import type { ProductAvailabilityInput } from '../inventory';

describe('isPurchasable — статус є джерелом правди (К2-Е0, Е0-3)', () => {
  it('in_stock — доступний навіть без жодного рядка залишків', () => {
    expect(isPurchasable('in_stock')).toBe(true);
  });
  it('null (статус не заданий) — доступний, як і DEFAULT схеми', () => {
    expect(isPurchasable(null)).toBe(true);
    expect(isPurchasable(undefined)).toBe(true);
  });
  it('on_order — доступний під замовлення', () => {
    expect(isPurchasable('on_order')).toBe(true);
  });
  it('out_of_stock — недоступний, навіть якщо залишки хтось забув обнулити', () => {
    expect(isPurchasable('out_of_stock')).toBe(false);
  });
});

describe('schemaOrgAvailability', () => {
  it('три статуси → три URL schema.org; on_order — BackOrder, не OutOfStock', () => {
    expect(schemaOrgAvailability('in_stock')).toBe('https://schema.org/InStock');
    expect(schemaOrgAvailability('on_order')).toBe('https://schema.org/BackOrder');
    expect(schemaOrgAvailability('out_of_stock')).toBe('https://schema.org/OutOfStock');
    expect(schemaOrgAvailability(null)).toBe('https://schema.org/InStock');
  });
});

describe('calculateProductAvailability', () => {
  it('простий товар: статус, а не кількість', () => {
    const inStock: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'in_stock', has_modifications: false,
    };
    const out: ProductAvailabilityInput = {
      id: 'p2', stock_status: 'out_of_stock', has_modifications: false,
      stock_by_pickup_point: [{ quantity: 3 }],
    };
    expect(calculateProductAvailability(inStock)).toBe(true);
    expect(calculateProductAvailability(out)).toBe(false);
  });

  it('товар із модифікаціями: доступний, якщо доступна будь-яка', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'out_of_stock', has_modifications: true,
      product_modifications: [
        { id: 'm1', stock_status: 'out_of_stock', is_default: true, sort_order: 0 },
        { id: 'm2', stock_status: 'in_stock', is_default: false, sort_order: 1 },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(true);
  });

  it('товар із модифікаціями, усі out_of_stock — недоступний', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'in_stock', has_modifications: true,
      product_modifications: [
        { id: 'm1', stock_status: 'out_of_stock', is_default: true, sort_order: 0 },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(false);
  });
});

describe('enrichProductsWithAvailability', () => {
  it('додає прапорець isAvailable за статусом', () => {
    const res = enrichProductsWithAvailability([
      { id: 'p1', stock_status: 'on_order', has_modifications: false },
      { id: 'p2', stock_status: 'out_of_stock', has_modifications: false },
    ]);
    expect(res.map((p) => p.isAvailable)).toEqual([true, false]);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/inventory.test.ts`
Expected: FAIL (`isPurchasable` не експортується; старі сигнатури).

- [ ] **Step 2: Домен — одне правило**

Замінити вміст `packages/simplycms/src/domain/inventory.ts`:

```ts
// Pure-правило наявності — ЄДИНЕ місце, де вирішується «можна купити».
// Перенесено з core/hooks/useProductsWithStock; переписано К2-Е0 (Е0-3).

import type { ProductAvailabilityInput, StockStatus } from 'simplycms/contracts';

export type { ProductAvailabilityInput, StockData } from 'simplycms/contracts';

/**
 * 🔴 Статус — джерело правди на читанні; кількість по точках — його деталь.
 *
 * До К2-Е0 у коді жило ШІСТЬ формул: три — перенос plpgsql `get_stock_info`
 * («qty > 0 або on_order»), дві — лише статус, JSON-LD — своя. Перша дає
 * «Немає в наявності» кожному магазину, що не веде обліку по точках (а
 * DEFAULT статусу в схемі — `in_stock`, тобто канон обіцяє протилежне).
 * Правдивість статусу при обліку тримає write-side: `createOrder` списує
 * залишок і переводить статус в `out_of_stock` на нулі
 * (`storefront/loaders/order-create.ts`).
 */
export function isPurchasable(status: string | null | undefined): boolean {
  return status !== 'out_of_stock';
}

/** Значення `availability` для schema.org Offer — з того самого статусу. */
export function schemaOrgAvailability(
  status: StockStatus | string | null | undefined,
):
  | 'https://schema.org/InStock'
  | 'https://schema.org/BackOrder'
  | 'https://schema.org/OutOfStock' {
  if (status === 'out_of_stock') return 'https://schema.org/OutOfStock';
  if (status === 'on_order') return 'https://schema.org/BackOrder';
  return 'https://schema.org/InStock';
}

/**
 * Доступність товару: для товару з модифікаціями — доступна будь-яка
 * модифікація; для простого — статус самого товару.
 */
export function calculateProductAvailability(
  product: ProductAvailabilityInput,
): boolean {
  const mods = product.product_modifications || [];
  const hasModifications = product.has_modifications ?? true;
  if (hasModifications && mods.length > 0) {
    return mods.some((m) => isPurchasable(m.stock_status));
  }
  return isPurchasable(product.stock_status);
}

/** Збагачує товари полем isAvailable. */
export function enrichProductsWithAvailability<
  T extends ProductAvailabilityInput,
>(products: T[]): (T & { isAvailable: boolean })[] {
  return products.map((product) => ({
    ...product,
    isAvailable: calculateProductAvailability(product),
  }));
}
```

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/inventory.test.ts`
Expected: PASS.

- [ ] **Step 3: Споживачі лоадерів**

`storefront/loaders/stock-info.ts`: імпорт `import { isPurchasable } from 'simplycms/domain/inventory';`
і `isAvailable: isPurchasable(stockStatus),` (замість `totalQuantity > 0 || stockStatus === 'on_order'`);
у докблоці `loadStockInfo` абзац «Правило доступності збережено дослівно…» →
«Доступність — `isPurchasable` (домен): статус, не кількість; `totalQuantity`
і `byPoint` — деталь показу».

`storefront/loaders/stock.ts:96`: `isAvailable: isPurchasable(row.stock_status),`
(той самий імпорт); докблок `loadModificationStock` — те саме речення.

`storefront/loaders/catalog-products.ts`: виклик `calculateProductAvailability({…}, { modificationStock, productStock })`
→ без другого аргумента; `modificationStock`/`productStock` там більше не
потрібні для доступності — якщо їх не читає ніхто інший у файлі, прибрати два
виклики `loadStockByModification`/`loadStockByProduct` і їхній імпорт
(перевірити `pnpm typecheck` — невикористані змінні валять лінт).

`core/hooks/useProductsWithStock.ts` та інші, хто кличе
`enrichProductsWithAvailability(products, stock)` → без другого аргумента
(`pnpm typecheck` покаже).

- [ ] **Step 4: JSON-LD — з того самого правила**

У `$productSlug.tsx`: імпорт `import { schemaOrgAvailability } from 'simplycms/domain/inventory';`
і `availability: schemaOrgAvailability(product.stock_status),` замість
тернарного `in_stock ? InStock : OutOfStock`.

- [ ] **Step 5: Харнес — фікстуру перенацілити, а не інвертувати**

У `fixtures/storefront-client.ts` коментар над `OUT_OF_STOCK_MOD_SLUG` →
«Модифікація зі статусом `out_of_stock` — негативний контроль наявності
(К2-Е0: статус, не кількість)», а в `CLIENT_FIXTURE_STATEMENTS` додати
стейтмент (після вставки залишку):

```ts
  // Негативний контроль правила «статус — джерело правди»: без цього рядка
  // модифікація без залишку була б ДОСТУПНОЮ (DEFAULT статусу — in_stock).
  `update public.product_modifications m
      set stock_status = 'out_of_stock'
     from public.products p
    where p.id = m.product_id
      and p.slug = '${MODIFIED_PRODUCT_SLUG}'
      and m.slug = '${OUT_OF_STOCK_MOD_SLUG}'`,
```

У `storefront-client-queries.test.ts:173-175` коментар → «🔴 Модифікація
`out_of_stock` мусить бути в мапі й недоступною — за СТАТУСОМ, не за нулем
залишку»; асерт лишається `{ totalQuantity: 0, isAvailable: false }`.
`showcase.test.ts:236-250` — без змін (доступна модифікація з залишком → `true`).

Run: `pnpm typecheck && pnpm test && pnpm test:schema`
Expected: PASS.

- [ ] **Step 6: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/domain packages/simplycms/src/storefront/loaders packages/simplycms/src/core packages/simplycms/routes packages/simplycms/test-harness
git commit -m "feat(k2-e0): isPurchasable — єдине правило наявності; JSON-LD BackOrder

Статус є джерелом правди на читанні (DEFAULT схеми — in_stock), кількість —
деталь показу. Шість формул зведено до домену; фікстура харнеса перенацілена
на out_of_stock замість інверсії, щоб негативний контроль лишився (Е0-3)."
```

---

### Task 9: Write-side — декремент під `decrease_on_order` у тій самій транзакції (Е0-3)

**Files:**
- Modify: `packages/simplycms/src/db/index.ts` (експорт типу `Actor`, якщо його немає)
- Modify: `packages/simplycms/src/storefront/loaders/db.ts:22-48` (`OperatorEscalation` у двох обгортках)
- Modify: `packages/simplycms/src/storefront/loaders/order-create.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`

**Interfaces:**
- Produces:
  - `type OperatorEscalation = <T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>` (`loaders/db.ts`);
  - `withCustomerDb(userId, fn: (db, operator: OperatorEscalation) => …)` і `withOrderTokenDb(token, fn: (db, operator) => …)` — другий аргумент `fn` опційний для чинних викликачів;
  - `createOrder(db, userId, accessToken, input, operator: OperatorEscalation): Promise<CreatedOrder>`;
  - `class InsufficientStockError extends Error { readonly productId; readonly modificationId }`;
  - `loadStockManagement(db): Promise<{ decrease_on_order: boolean }>`.
- Consumes: `withActor` (`fn(db, client)`), `Actor` з `simplycms/db`.

- [ ] **Step 1: Харнес-тест — спершу червоний**

`packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`:

```ts
// Write-side правила наявності (К2-Е0, Е0-3): замовлення списує залишок у
// ТІЙ САМІЙ транзакції, статус стає out_of_stock на нулі, нестача — відмова
// без рядка в orders. Тумблер `stock_management.decrease_on_order` отримує
// свого єдиного читача.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  InsufficientStockError,
  createOrder,
  withOrderTokenDb,
  type NewOrderInput,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase, queryRows,
  randomDbName, withDbName, withUser,
} from '../apply.mjs';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const PRODUCT_SLUG = 'sonyachna-panel-450w-mono';
const POINT_A = 'Склад A';
const POINT_B = 'Склад B';

interface IdRow { id: string }
interface QtyRow { quantity: number }

const baseInput = (productId: string, quantity: number, methodId: string): NewOrderInput => ({
  firstName: 'Тест', lastName: 'Покупець', email: 'buyer@example.test', phone: '+380000000000',
  shippingMethodId: methodId, deliveryCity: null, deliveryAddress: null, pickupPointId: null,
  paymentMethod: 'cash', notes: null, subtotal: 4800 * quantity, shippingCost: 0,
  total: 4800 * quantity, hasDifferentRecipient: false, recipientFirstName: null,
  recipientLastName: null, recipientPhone: null, recipientEmail: null,
  savedRecipientId: null, savedAddressId: null,
  items: [{ productId, modificationId: null, name: 'Панель 450', price: 4800, quantity, basePrice: null, discountData: null }],
});

describe('замовлення списує залишок', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_order_stock');
  let dbUrl = '';
  let productId = '';
  let methodId = '';

  const quantities = async (): Promise<number[]> =>
    ((await queryRows(dbUrl,
      `select s.quantity from public.stock_by_pickup_point s
         join public.pickup_points pp on pp.id = s.pickup_point_id
        where s.product_id = $1 order by pp.sort_order`, [productId])) as QtyRow[])
      .map((r) => Number(r.quantity));

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort().map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    // `on conflict (code)`: з Task 13 демо-сід сам везе метод `pickup` (B4 аудиту r1).
    await queryRows(dbUrl, `insert into public.shipping_methods (id, code, name) values (gen_random_uuid(), 'pickup', 'Самовивіз') on conflict (code) do nothing`);
    [{ id: methodId }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'pickup'`)) as IdRow[];
    [{ id: productId }] = (await queryRows(dbUrl, `select id from public.products where slug = $1`, [PRODUCT_SLUG])) as IdRow[];
    await queryRows(dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, '${POINT_A}', 'вул. А, 1', 'Київ', true, 0),
              (gen_random_uuid(), $1, '${POINT_B}', 'вул. Б, 2', 'Київ', true, 1)`, [methodId]);
    await queryRows(dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       select gen_random_uuid(), pp.id, $1, null, case pp.name when '${POINT_A}' then 2 else 3 end
         from public.pickup_points pp where pp.name in ('${POINT_A}', '${POINT_B}')`, [productId]);
    await queryRows(dbUrl, `update public.system_settings set value = '{"decrease_on_order": true}'::jsonb where key = 'stock_management'`);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('списує з точок у порядку показу і не чіпає статус, доки залишок є', async () => {
    const token = crypto.randomUUID();
    const order = await withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, baseInput(productId, 3, methodId), operator),
    );
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await quantities()).toEqual([0, 2]);
    const [{ stock_status }] = (await queryRows(dbUrl, `select stock_status from public.products where id = $1`, [productId])) as { stock_status: string }[];
    expect(stock_status).toBe('in_stock');
  });

  it('на нулі переводить статус в out_of_stock', async () => {
    const token = crypto.randomUUID();
    await withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, baseInput(productId, 2, methodId), operator),
    );
    expect(await quantities()).toEqual([0, 0]);
    const [{ stock_status }] = (await queryRows(dbUrl, `select stock_status from public.products where id = $1`, [productId])) as { stock_status: string }[];
    expect(stock_status).toBe('out_of_stock');
  });

  it('🔴 нестача — відмова, і рядка в orders НЕМАЄ (транзакція відкочена)', async () => {
    const before = (await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[];
    const token = crypto.randomUUID();
    await expect(
      withOrderTokenDb(token, (db, operator) =>
        createOrder(db, null, token, baseInput(productId, 1, methodId), operator),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    const after = (await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[];
    expect(after[0].c).toBe(before[0].c);
  });

  it('🔴 два конкурентні замовлення на залишок 3 по 2 шт — рівно одне проходить (guarded UPDATE)', async () => {
    // Послідовні кейси вище зеленіли б і для «SELECT → безумовний UPDATE», який
    // оверселить при перетині транзакцій; тут дві транзакції справді перетинаються.
    const [{ id: third }] = (await queryRows(dbUrl, `select id from public.products where slug = 'sonyachna-panel-600w-bifacial'`)) as IdRow[];
    await queryRows(dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       select gen_random_uuid(), pp.id, $1, null, 3 from public.pickup_points pp where pp.name = '${POINT_A}'`, [third]);
    const attempt = () => { const token = crypto.randomUUID(); return withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, baseInput(third, 2, methodId), operator)); };
    const settled = await Promise.allSettled([attempt(), attempt()]);
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const rejected = settled.filter((r) => r.status === 'rejected' && r.reason instanceof InsufficientStockError).length;
    expect([ok, rejected]).toEqual([1, 1]);
    const [{ quantity }] = (await queryRows(dbUrl, `select quantity from public.stock_by_pickup_point where product_id = $1`, [third])) as QtyRow[];
    expect(Number(quantity)).toBe(1);
  });

  it('товар без рядків залишків — обліку немає, замовлення проходить, статус не змінюється', async () => {
    const [{ id: other }] = (await queryRows(dbUrl, `select id from public.products where slug = 'sonyachna-panel-550w-mono'`)) as IdRow[];
    const token = crypto.randomUUID();
    const order = await withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, baseInput(other, 5, methodId), operator),
    );
    expect(order.orderNumber).toMatch(/^\d{6}-[0-9A-F]{6}$/);
    const [{ stock_status }] = (await queryRows(dbUrl, `select stock_status from public.products where id = $1`, [other])) as { stock_status: string }[];
    expect(stock_status).toBe('in_stock');
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`
Expected: FAIL (`operator` не існує; `InsufficientStockError` не експортується).

- [ ] **Step 2: Scoped-ескалація в обгортках `loaders/db.ts`**

Перевірити експорт: `grep -n "Actor" packages/simplycms/src/db/index.ts`; якщо
`Actor` не експортується — додати `export type { Actor, ActorRole } from './actor';`.

У `packages/simplycms/src/storefront/loaders/db.ts` замінити `withCustomerDb`
і `withOrderTokenDb` та додати тип і фабрику:

```ts
import { withActor, type Actor, type ActorDb } from 'simplycms/db';
import type pg from 'pg';

/**
 * Службова дія магазину ВСЕРЕДИНІ транзакції покупця — під `app_admin`,
 * з негайним поверненням до ролі актора.
 *
 * 🔴 Навіщо, коли є `withStoreOperatorDb`: декремент залишку мусить бути в
 * ТІЙ САМІЙ транзакції, що й вставка замовлення (інакше замовлення без
 * списання або списання без замовлення), а `app_user` за `0002_grants.sql`
 * має на `stock_by_pickup_point`/`products` лише SELECT — і це правильно:
 * покупець не пише в облік. Тому роль перемикається рівно на час службової
 * дії тим самим `SET LOCAL ROLE`, яким її ставить `withActor`; runtime-роль
 * має `set true` на обидві (`grant … with inherit false, set true`).
 *
 * Правило використання — те саме, що в `withStoreOperatorDb`, лише всередині
 * однієї транзакції: викликати ПІСЛЯ того, як RLS уже прийняла запис
 * покупця в цій транзакції (вставка замовлення), і лише для обліку магазину
 * — ніколи для читання чи запису чужих рядків. Функція недоступна поза
 * обгортками нижче: її створює сама транзакція, тож «ескалація з нізвідки»
 * неможлива за побудовою.
 */
export type OperatorEscalation = <T>(
  fn: (db: ActorDb) => Promise<T>,
) => Promise<T>;

function escalationFor(
  client: pg.PoolClient,
  db: ActorDb,
  actor: Actor,
): OperatorEscalation {
  return async (fn) => {
    await client.query('set local role app_admin');
    const result = await fn(db);
    // 🔴 Роль повертається ЛИШЕ на success-path. Якщо `fn` кинув, транзакція
    // вже aborted — будь-який наступний запит, включно з `set local role`,
    // впав би з 25P02 і ЗАМАСКУВАВ би першопричину; outer rollback у
    // `withActor` сам скидає SET LOCAL ROLE. Імʼя ролі — з валідованого `Actor`.
    await client.query(`set local role ${actor.role}`);
    return result;
  };
}

export function withCustomerDb<T>(
  userId: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', userId };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}

export function withOrderTokenDb<T>(
  orderToken: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', orderToken };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}
```

Докблоки над `withCustomerDb`/`withOrderTokenDb` лишаються (перенести над
новими сигнатурами). Чинні викликачі з одним параметром `fn` не змінюються.

- [ ] **Step 3: `order-create.ts` — списання, переворот статусу, помилка**

Додати в `packages/simplycms/src/storefront/loaders/order-create.ts`
(імпорти: `and, asc, eq, isNull, sql` з `drizzle-orm`; `pickupPoints,
productModifications, products, stockByPickupPoint, systemSettings` зі
схеми; `OperatorEscalation` з `./db`):

```ts
/** Нестача залишку: транзакція відкочується, замовлення не створюється. */
export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string | null,
    readonly modificationId: string | null,
  ) {
    super('[simplycms/orders] insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

/** Налаштування обліку: чи списувати залишок при оформленні. */
export async function loadStockManagement(
  db: ActorDb,
): Promise<{ decrease_on_order: boolean }> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'stock_management'))
    .limit(1);
  const value = (row?.value ?? {}) as { decrease_on_order?: unknown };
  return { decrease_on_order: value.decrease_on_order === true };
}

/**
 * Списує `quantity` позиції з точок видачі в порядку показу.
 *
 * 🔴 Викликається ПІД `app_admin` (operator) у транзакції замовлення. Без
 * рядків залишків — облік для цілі не ведеться, нічого не змінюється. Коли
 * сума по цілі стає 0 — статус переводиться в `out_of_stock`: саме так
 * read-side правило `isPurchasable` (статус, не кількість) лишається
 * правдивим для магазину, що веде облік.
 */
async function reserveStock(db: ActorDb, item: NewOrderItem): Promise<void> {
  const scope = item.modificationId
    ? eq(stockByPickupPoint.modificationId, item.modificationId)
    : and(
        eq(stockByPickupPoint.productId, item.productId ?? ''),
        isNull(stockByPickupPoint.modificationId),
      );
  const rows = await db
    .select({ id: stockByPickupPoint.id, quantity: stockByPickupPoint.quantity })
    .from(stockByPickupPoint)
    .innerJoin(pickupPoints, eq(pickupPoints.id, stockByPickupPoint.pickupPointId))
    .where(and(scope, eq(pickupPoints.isActive, true)))
    .orderBy(asc(pickupPoints.sortOrder));
  if (rows.length === 0) return;

  const available = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (available < item.quantity) {
    throw new InsufficientStockError(item.productId, item.modificationId);
  }

  let left = item.quantity;
  for (const row of rows) {
    if (left === 0) break;
    const take = Math.min(row.quantity, left);
    if (take === 0) continue;
    // Гард `quantity >= take` — проти паралельного списання між SELECT і UPDATE.
    const updated = await db
      .update(stockByPickupPoint)
      .set({ quantity: sql`${stockByPickupPoint.quantity} - ${take}` })
      .where(and(eq(stockByPickupPoint.id, row.id), sql`${stockByPickupPoint.quantity} >= ${take}`))
      .returning({ id: stockByPickupPoint.id });
    if (updated.length === 0) {
      throw new InsufficientStockError(item.productId, item.modificationId);
    }
    left -= take;
  }

  if (available - item.quantity === 0) {
    if (item.modificationId) {
      await db
        .update(productModifications)
        .set({ stockStatus: 'out_of_stock' })
        .where(eq(productModifications.id, item.modificationId));
    } else if (item.productId) {
      await db
        .update(products)
        .set({ stockStatus: 'out_of_stock' })
        .where(eq(products.id, item.productId));
    }
  }
}
```

Сигнатуру `createOrder` розширити пʼятим параметром
`operator: OperatorEscalation`, а після вставки `orderItems` (перед
`return`):

```ts
  // 🔴 Списання — після того, як RLS прийняла вставку замовлення й позицій
  // покупцем: право на цю транзакцію вже доведено, службова дія йде під
  // операторською роллю в тій самій транзакції (див. `escalationFor`).
  const { decrease_on_order } = await loadStockManagement(db);
  if (decrease_on_order) {
    await operator(async (odb) => {
      for (const item of input.items) await reserveStock(odb, item);
    });
  }
```

Викликачі `createOrder` без `operator` (`storefront-personal-data.test.ts:~120`,
`checkout.ts`) — передати його з обгортки: `withCustomerDb(userId, (db, operator) =>
createOrder(db, userId, null, input, operator))` (у `checkout.ts` `run` переписується
в Task 10; тут — лише щоб `typecheck` був зелений: `run` приймає `fn(db, operator)`).

Run: `pnpm typecheck && pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`
Expected: PASS (5 кейсів).

- [ ] **Step 4: Негативний контроль ролі — списання без ескалації падає**

Тимчасово в `createOrder` замінити `await operator(async (odb) => …)` на
`await (async () => { for (const item of input.items) await reserveStock(db, item); })()`
і прогнати той самий тест.

Expected: перший кейс FAIL із `permission denied for table stock_by_pickup_point`
— доказ, що `app_user` не пише в облік і ескалація не декоративна. Повернути
код (`git checkout -- packages/simplycms/src/storefront/loaders/order-create.ts`
неможливий — файл новий у дифі; відкотити правку вручну), тест знову PASS.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add packages/simplycms/src/db/index.ts packages/simplycms/src/storefront/loaders/db.ts packages/simplycms/src/storefront/loaders/order-create.ts packages/simplycms/src/storefront-routes/server/checkout.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts packages/simplycms/test-harness/pg/__tests__/storefront-personal-data.test.ts
git commit -m "feat(k2-e0): замовлення списує залишок під decrease_on_order у тій самій транзакції

Ескалація до app_admin — scoped, усередині транзакції покупця, після
RLS-прийнятої вставки замовлення; app_user на облік не пише (негативний
контроль — permission denied без ескалації). На нулі статус → out_of_stock;
нестача — InsufficientStockError і відкат без рядка в orders (Е0-3)."
```

---
### Task 10: Чекаут — сервер рахує і відмовляє доменно (Е0-4, сервер)

**Files:**
- Modify: `packages/simplycms/src/storefront-routes/server/checkout-input.ts`
- Modify: `packages/simplycms/src/storefront-routes/server/checkout.ts`
- Create: `packages/simplycms/src/storefront/loaders/checkout-items.ts`
- Create: `packages/simplycms/src/storefront/loaders/place-order.ts`
- Modify: `packages/simplycms/src/storefront/loaders/pricing.ts` (`loadPricesByProduct`)
- Modify: `packages/simplycms/src/storefront/loaders/index.ts` (реекспорт нового модуля)
- Modify: `packages/simplycms/src/storefront-routes/pages/Checkout.tsx:170-262`
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`

**Interfaces:**
- Produces:
  - `checkoutItemSchema = { productId: uuid, modificationId: uuid | null, quantity: int > 0 }`; з `checkoutInputSchema` зникають `shippingCost` і поля ціни позицій;
  - `type PlaceOrderRejection = 'shipping_unavailable' | 'pickup_point_invalid' | 'not_purchasable'`;
  - `type PlaceOrderResult = { ok: true; order: PlacedOrder } | { ok: false; reason: PlaceOrderRejection }`;
  - `placeOrder(...): Promise<PlaceOrderResult>` — тонкий serverFn у `checkout.ts`;
  - `placeOrderFor(input: PlaceOrderInput, userId: string | null): Promise<PlaceOrderResult>` і `type PlaceOrderInput` (поля `checkoutInputSchema`) — у `storefront/loaders/place-order.ts`. 🔴 Саме в server-only дереві, а НЕ як другий експорт `checkout.ts`: живий не-serverFn експорт поруч із serverFn лишається в клієнтському модулі й тягне `simplycms/storefront/loaders` у клієнтський граф — Import Protection тоді валить збірку магазину (той самий клас, що описано в `core/lib/price-type.ts` і `v2-state-map.md` §3.1);
  - `loadPricesByProduct(db, productIds): Promise<Record<string, PriceEntry[]>>` (`loaders/pricing.ts`);
  - `loadCheckoutProducts(db, ids)` і `loadCheckoutModifications(db, ids)` (`loaders/checkout-items.ts`);
  - `priceCheckoutItems(db, userId, items): Promise<NewOrderItem[] | PlaceOrderRejection>` — серверне ціноутворення (`loaders/checkout-items.ts`);
  - i18n-ключі `checkout.rejected.shipping_unavailable|pickup_point_invalid|not_purchasable`.
- Consumes: `isPurchasable` (Task 8); `createOrder(…, operator)`, `InsufficientStockError`, `OperatorEscalation` (Task 9); `resolvePrice`, `resolveDiscount`, `resolveShippingRate`, `findShippingZoneIn`; `loadShippingDirectory`, `loadDiscountGroups`, `loadUserCategoryId`, `loadUserPriceTypeId`, `loadDefaultPriceTypeId`.

- [ ] **Step 1: Харнес-тест воронки — спершу червоний**

`packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts` — тест
викликає ЛОГІКУ `placeOrder` без RPC (serverFn поза HTTP не виконується), тому
логіка хендлера живе в server-only модулі `storefront/loaders/place-order.ts`
(`placeOrderFor(input, userId)`, Step 3), який тест і кличе:

```ts
// Воронка: кошик → placeOrderFor → рядок в orders; три доменні відмови
// (К2-Е0, Е0-4). Ціни й доставку рахує СЕРВЕР — у вхідних даних їх немає.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { placeOrderFor, type PlaceOrderInput } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase, queryRows,
  randomDbName, withDbName, withUser,
} from '../apply.mjs';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
interface IdRow { id: string }

/**
 * 10 % на панель для категорії `retail` (за замовчуванням) — форма стейтментів
 * ТА САМА, що в `fixtures/showcase.ts` (discount_groups → discounts →
 * discount_targets); скопіювати звідти й підставити ціль/відсоток.
 */
const RETAIL_DISCOUNT_FIXTURE: string[] = [
  // …скопійовані стейтменти showcase з категорією 'retail', відсотком 10 і
  // ціллю product = 'sonyachna-panel-450w-mono'
];

const input = (overrides: Partial<PlaceOrderInput>): PlaceOrderInput => ({
  firstName: 'Тест', lastName: 'Покупець', email: 'buyer@example.test', phone: '+380000000000',
  shippingMethodId: '', deliveryCity: null, deliveryAddress: null, pickupPointId: null,
  paymentMethod: 'cash', notes: null, hasDifferentRecipient: false,
  recipientFirstName: null, recipientLastName: null, recipientPhone: null, recipientEmail: null,
  recipientCity: null, recipientAddress: null, recipientNotes: null, saveRecipient: false,
  savedRecipientId: null, savedAddressId: null, items: [],
  ...overrides,
});

describe('placeOrderFor: воронка й доменні відмови', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_checkout');
  let dbUrl = '';
  let activeMethod = '';
  let inactiveMethod = '';
  let pickupPoint = '';
  let panel = '';
  let outOfStock = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort().map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    // `on conflict (code)`: з Task 13 демо-сід сам везе `pickup` (B4 аудиту r1).
    await queryRows(dbUrl, `insert into public.shipping_methods (id, code, name, is_active)
      values (gen_random_uuid(), 'pickup', 'Самовивіз', true), (gen_random_uuid(), 'old', 'Вимкнений', false)
      on conflict (code) do nothing`);
    // 🔴 `shipping_rates.zone_id` — NOT NULL: тариф без зони не вставиться.
    await queryRows(dbUrl, `insert into public.shipping_zones (id, name, is_active, is_default)
      values (gen_random_uuid(), 'Тестова зона', true, true)`);
    const [{ id: zoneId }] = (await queryRows(dbUrl, `select id from public.shipping_zones where name = 'Тестова зона'`)) as IdRow[];
    [{ id: activeMethod }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'pickup'`)) as IdRow[];
    [{ id: inactiveMethod }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'old'`)) as IdRow[];
    await queryRows(dbUrl, `insert into public.pickup_points (id, method_id, name, address, city, is_active)
      values (gen_random_uuid(), $1, 'Склад', 'вул. Тестова, 1', 'Київ', true)`, [activeMethod]);
    [{ id: pickupPoint }] = (await queryRows(dbUrl, `select id from public.pickup_points where name = 'Склад'`)) as IdRow[];
    await queryRows(dbUrl, `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
      values (gen_random_uuid(), $1, $2, 'Безкоштовно', 'flat', 0, true, 0)`, [activeMethod, zoneId]);
    [{ id: panel }] = (await queryRows(dbUrl, `select id from public.products where slug = 'sonyachna-panel-450w-mono'`)) as IdRow[];
    [{ id: outOfStock }] = (await queryRows(dbUrl, `select id from public.products where slug = 'sonyachna-panel-550w-mono'`)) as IdRow[];
    await queryRows(dbUrl, `update public.products set stock_status = 'out_of_stock' where id = $1`, [outOfStock]);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('гість: замовлення з серверною ціною позиції та доставкою', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: activeMethod, pickupPointId: pickupPoint,
        items: [{ productId: panel, modificationId: null, quantity: 2 }] }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(dbUrl,
      `select o.subtotal, o.shipping_cost, o.total, i.price, i.name
         from public.orders o join public.order_items i on i.order_id = o.id where o.id = $1`,
      [result.order.id])) as { subtotal: string; shipping_cost: string; total: string; price: string; name: string }[];
    // 4800 — ціна з product_prices демо-сіду, не з запиту (запит ціни не несе).
    expect(row.price).toBe('4800.00');
    expect(row.subtotal).toBe('9600.00');
    expect(row.shipping_cost).toBe('0.00');
    expect(row.total).toBe('9600.00');
    expect(row.name).toBe('Сонячна панель 450 Вт монокристалічна');
  });

  it('неактивний спосіб доставки — shipping_unavailable, рядка немає', async () => {
    const before = (await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[];
    const result = await placeOrderFor(
      input({ shippingMethodId: inactiveMethod, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    const after = (await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[];
    expect(after[0].c).toBe(before[0].c);
  });

  it('точка видачі чужого методу — pickup_point_invalid', async () => {
    await queryRows(dbUrl, `insert into public.shipping_methods (id, code, name, is_active) values (gen_random_uuid(), 'courier', 'Курʼєр', true)`);
    const [{ id: courier }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'courier'`)) as IdRow[];
    const [{ id: zoneId }] = (await queryRows(dbUrl, `select id from public.shipping_zones where name = 'Тестова зона'`)) as IdRow[];
    await queryRows(dbUrl, `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
      values (gen_random_uuid(), $1, $2, 'Тариф', 'flat', 100, true, 0)`, [courier, zoneId]);
    const result = await placeOrderFor(
      input({ shippingMethodId: courier, pickupPointId: pickupPoint, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('pickup-метод без точки видачі — pickup_point_invalid', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: activeMethod, pickupPointId: null, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('активний метод без застосовного тарифу — shipping_unavailable, а не безкоштовно', async () => {
    await queryRows(dbUrl, `insert into public.shipping_methods (id, code, name, is_active) values (gen_random_uuid(), 'norate', 'Без тарифу', true) on conflict (code) do nothing`);
    const [{ id: norate }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'norate'`)) as IdRow[];
    const result = await placeOrderFor(
      input({ shippingMethodId: norate, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
  });

  it('гість отримує знижку категорії за замовчуванням — як у getDiscountEnvironment', async () => {
    // Фікстура знижки — за зразком блоку знижок у fixtures/showcase.ts
    // (discount_groups → discounts → discount_targets), але ціль — категорія
    // `retail` (за замовчуванням), 10 % на товар `panel`. Без дзеркала
    // getDiscountEnvironment гість платив би 4800, а картка показує 4320.
    for (const statement of RETAIL_DISCOUNT_FIXTURE) await queryRows(dbUrl, statement);
    const result = await placeOrderFor(
      input({ shippingMethodId: activeMethod, pickupPointId: pickupPoint,
        items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(dbUrl, `select price, base_price from public.order_items where order_id = $1`, [result.order.id])) as { price: string; base_price: string | null }[];
    expect(row.price).toBe('4320.00');
    expect(row.base_price).toBe('4800.00');
  });

  it('позиція out_of_stock — not_purchasable', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: activeMethod, pickupPointId: pickupPoint,
        items: [{ productId: outOfStock, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });
});
```

🔴 Імена колонок `shipping_rates` (`calculation_type`, `base_cost`) звірити з
`packages/simplycms/src/schema/schema.ts` (`shippingRates`) перед запуском; якщо
відрізняються — правити SQL фікстури, не схему.

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`
🔴 Кейс зі знижкою: SQL фікстури взяти дослівно з блоку знижок
`fixtures/showcase.ts` (`SHOWCASE_FIXTURE_STATEMENTS`, група → знижка →
ціль), замінивши категорію-ціль на `retail` і відсоток на 10 — це не
плейсхолдер, а вказівка перевикористати наявну фікстуру; якщо форма
таблиць знижок інша, ніж у showcase, — правити тест, не домен.

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`
Expected: FAIL (`placeOrderFor` не існує).

- [ ] **Step 2: Схема запиту без цін і доставки**

`checkout-input.ts`: `checkoutItemSchema` → рівно три поля:

```ts
/**
 * Позиція кошика — ЛИШЕ ідентичність і кількість. Ціну, назву й доступність
 * рахує сервер (К2-Е0, Е0-4): усе, що приїхало б із кошика як «істина»,
 * можна підмінити в запиті (борг 0.4.1-4).
 */
export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  modificationId: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
});
```

Зі `checkoutInputSchema` прибрати `shippingCost`. Типи результату живуть у
`storefront/loaders/place-order.ts` (Step 3) — `checkout-input.ts` лишається
ізоморфним модулем схеми без серверних імпортів.

- [ ] **Step 3: Серверне ціноутворення й валідація**

`packages/simplycms/src/storefront/loaders/pricing.ts` — додати:

```ts
/** Ціни кількох товарів одним запитом — для серверного резолву позицій чекауту. */
export async function loadPricesByProduct(
  db: ActorDb,
  productIds: string[],
): Promise<Record<string, PriceEntry[]>> {
  if (productIds.length === 0) return {};
  const rows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(inArray(productPrices.productId, productIds));
  return groupPricesByProduct(rows);
}
```

(імпорти: `inArray` з `drizzle-orm`, `productPrices` зі схеми, `priceColumns`,
`groupPricesByProduct` з `./entities/price`, `PriceEntry` з `simplycms/contracts`).

`packages/simplycms/src/storefront/loaders/checkout-items.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import { resolveDiscount } from 'simplycms/domain/discounts';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';
import type { ActorDb } from './db';
import { loadDefaultUserCategoryId, loadUserCategoryId } from './categories';
import { loadDiscountGroups } from './discounts';
import type { NewOrderItem } from './order-create';
import { loadDefaultPriceTypeId, loadPricesByProduct } from './pricing';
import { loadUserPriceTypeId } from './profile';

/** Позиція запиту чекауту — ідентичність і кількість. */
export interface CheckoutItemRef {
  productId: string;
  modificationId: string | null;
  quantity: number;
}

/**
 * Серверне ціноутворення позицій (К2-Е0, Е0-4).
 *
 * 🔴 Той самий ланцюг, що на картці товару, і те саме СЕРЕДОВИЩЕ знижок, що
 * будує `core/lib/discounts.ts::getDiscountEnvironment`: тип ціни і категорія
 * — персональні, з відкатом на ДЕФОЛТНІ (гість і покупець без категорії
 * дістають категорію за замовчуванням, не `null`); групи знижок читаються за
 * ефективним типом ціни (`loadDiscountGroups(db, priceTypeId)`). Інакше
 * чекаут рахував би інші знижки, ніж каталог (B2 аудиту r1). Кошик несе лише
 * id і кількість — назва, ціна і статус беруться з БД у цій же транзакції.
 */
export async function priceCheckoutItems(
  db: ActorDb,
  userId: string | null,
  items: CheckoutItemRef[],
): Promise<NewOrderItem[] | 'not_purchasable'> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const modIds = items.map((i) => i.modificationId).filter((id): id is string => id !== null);

  const productRows = await db
    .select({ id: products.id, name: products.name, section_id: products.sectionId,
      stock_status: products.stockStatus, is_active: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds));
  const modRows = modIds.length
    ? await db
        .select({ id: productModifications.id, product_id: productModifications.productId,
          name: productModifications.name, stock_status: productModifications.stockStatus })
        .from(productModifications)
        .where(inArray(productModifications.id, modIds))
    : [];
  const prices = await loadPricesByProduct(db, productIds);
  const defaultPriceType = await loadDefaultPriceTypeId(db);
  const defaultCategory = await loadDefaultUserCategoryId(db);
  const userPriceType = userId ? await loadUserPriceTypeId(db, userId) : null;
  const userCategory = userId ? await loadUserCategoryId(db, userId) : null;
  const priceTypeId = userPriceType ?? defaultPriceType;
  const userCategoryId = userCategory ?? defaultCategory;
  const groups = priceTypeId ? await loadDiscountGroups(db, priceTypeId) : [];

  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  const byMod = new Map(modRows.map((m) => [m.id, m]));
  const cartTotal = items.reduce((sum, item) => {
    const base = resolvePrice(prices[item.productId] ?? [], priceTypeId, defaultPriceType, item.modificationId).price ?? 0;
    return sum + base * item.quantity;
  }, 0);

  const result: NewOrderItem[] = [];
  for (const item of items) {
    const product = byProduct.get(item.productId);
    const mod = item.modificationId ? byMod.get(item.modificationId) : null;
    if (!product || !product.is_active) return 'not_purchasable';
    if (item.modificationId && (!mod || mod.product_id !== item.productId)) return 'not_purchasable';
    if (!isPurchasable(mod ? mod.stock_status : product.stock_status)) return 'not_purchasable';

    const { price: basePrice } = resolvePrice(prices[item.productId] ?? [], priceTypeId, defaultPriceType, item.modificationId);
    if (basePrice === null) return 'not_purchasable';

    const discount = resolveDiscount(basePrice, groups, {
      userId, userCategoryId, quantity: item.quantity, cartTotal,
      productId: item.productId, modificationId: item.modificationId,
      sectionId: product.section_id, isLoggedIn: userId !== null, now: new Date(),
    });

    result.push({
      productId: item.productId,
      modificationId: item.modificationId,
      name: mod ? `${product.name} - ${mod.name}` : product.name,
      price: discount.finalPrice,
      quantity: item.quantity,
      basePrice: discount.totalDiscount > 0 ? basePrice : null,
      discountData: discount.totalDiscount > 0
        ? { applied: discount.appliedDiscounts as unknown as JsonValue }
        : null,
    });
  }
  return result;
}
```

(`JsonValue` — з `./entities/property`; сигнатури `loadDiscountGroups(db)` і
`loadUserCategoryId(db, userId)` звірити з `loaders/discounts.ts:31` і
`loaders/profile.ts` перед використанням — якщо приймають додаткові
параметри, передати ті самі, що передає `core/hooks/useDiscountedPrice.ts`.)
У `loaders/index.ts` — `export * from './checkout-items';`.

`packages/simplycms/src/storefront/loaders/place-order.ts` — уся логіка
оформлення (сюди ж переїжджають `resolveRecipient` і `toOrderInput` із
`checkout.ts`); `checkout.ts` стає тонким serverFn:

```ts
// storefront-routes/server/checkout.ts — РІВНО один експорт-serverFn і
// жодної звичайної функції (той самий урок, що в core/lib/price-type.ts).
export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }) =>
    placeOrderFor(data as PlaceOrderInput, await optionalSessionUserId()),
  );
```

```ts
// storefront/loaders/place-order.ts
/** Поля запиту оформлення — дзеркало `checkoutInputSchema` (Zod живе в T5, тип — тут, у T2). */
export interface PlaceOrderInput {
  firstName: string; lastName: string; email: string; phone: string;
  shippingMethodId: string; deliveryCity: string | null; deliveryAddress: string | null;
  pickupPointId: string | null; paymentMethod: string; notes: string | null;
  hasDifferentRecipient: boolean; recipientFirstName: string | null;
  recipientLastName: string | null; recipientPhone: string | null;
  recipientEmail: string | null; recipientCity: string | null;
  recipientAddress: string | null; recipientNotes: string | null;
  saveRecipient: boolean; savedRecipientId: string | null; savedAddressId: string | null;
  items: CheckoutItemRef[];
}

/** Доменні відмови оформлення — КОДОМ; текст — у каталозі повідомлень. */
export type PlaceOrderRejection =
  | 'shipping_unavailable'
  | 'pickup_point_invalid'
  | 'not_purchasable';

export type PlaceOrderResult =
  | { ok: true; order: CreatedOrder }
  | { ok: false; reason: PlaceOrderRejection };

/**
 * Логіка оформлення без RPC-обгортки — щоб харнес доводив воронку напряму.
 *
 * 🔴 Живе в server-only дереві `storefront` (декларація межі), а не другим
 * експортом поруч із serverFn: у клієнтському модулі не-serverFn експорт
 * лишається живим і тягне лоадери в клієнтський граф — Import Protection
 * валить збірку магазину.
 *
 * Порядок: довідники й ціни читаються під актором покупця (лише SELECT),
 * відмови повертаються КОДОМ до будь-якого запису; запис — одна транзакція
 * з ескалацією для обліку (див. `createOrder`).
 */
export async function placeOrderFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<PlaceOrderResult> {
  const accessToken = userId === null ? randomUUID() : null;
  const run = <T>(fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>): Promise<T> =>
    userId === null
      ? withOrderTokenDb(accessToken as string, fn)
      : withCustomerDb(userId, fn);

  try {
    // 🔴 ОДНА транзакція на все: довідники, ціни, отримувач, запис. Дві
    // послідовні (спершу читання, потім запис) залишали б вікно, у якому
    // ціна, тариф чи залишок змінюються між ними (B3 аудиту r1). Відмови —
    // значеннями (до жодного запису), нестача залишку — винятком з відкатом.
    return await run(async (db, operator) => {
      const directory = await loadShippingDirectory(db);
      const method = directory.methods.find(
        (m) => m.id === input.shippingMethodId && m.is_active,
      );
      if (!method) return { ok: false, reason: 'shipping_unavailable' } as const;

      // Pickup — за КОДОМ методу, як і UI (`CheckoutDeliveryForm`: `code === 'pickup'`):
      // pickup вимагає активну точку ЦЬОГО методу; не-pickup точки не приймає.
      const isPickup = method.code === 'pickup';
      const point = input.pickupPointId
        ? directory.pickupPoints.find(
            (p) => p.id === input.pickupPointId && p.method_id === method.id && p.is_active,
          )
        : null;
      if (isPickup && !point) return { ok: false, reason: 'pickup_point_invalid' } as const;
      if (!isPickup && input.pickupPointId) return { ok: false, reason: 'pickup_point_invalid' } as const;

      const items = await priceCheckoutItems(db, userId, input.items);
      if (items === 'not_purchasable') return { ok: false, reason: 'not_purchasable' } as const;

      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const zone = findShippingZoneIn(directory.zones, input.deliveryCity ?? '');
      const rate = resolveShippingRate({ method, zone, cart: { items: [], subtotal } }, directory.rates);
      // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
      if (rate === null) return { ok: false, reason: 'shipping_unavailable' } as const;

      const savedRecipientId = await resolveRecipient(db, userId, input);
      const order = await createOrder(db, userId, accessToken,
        toOrderInput(input, savedRecipientId, { items, subtotal, shippingCost: rate.cost }), operator);
      return { ok: true, order } as const;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) return { ok: false, reason: 'not_purchasable' };
    throw error;
  }
}
```

`toOrderInput(input, savedRecipientId, prepared)` — третій параметр
`{ items: NewOrderItem[]; subtotal: number; shippingCost: number }`: замість
`input.items`/`input.shippingCost`/локального `subtotal` брати з `prepared`;
`total: prepared.subtotal + prepared.shippingCost`. Імпорти в `place-order.ts` —
ВІДНОСНІ всередині дерева (`./shipping`, `./checkout-items`, `./order-create`,
`./db`, `./recipients`), домен — `simplycms/domain/shipping`; у
`loaders/index.ts` — `export * from './place-order';`. `checkout.ts` імпортує
`placeOrderFor`, `PlaceOrderInput`, `optionalSessionUserId` з
`simplycms/storefront/loaders` (bare, як і решта serverFn-модулів).
Поле `method_id`/`is_active` у `PickupPointRow` — звірити назви з
`loaders/pickup-points.ts` (`Omit<PickupPoint, 'zone'>` → контракт `PickupPoint`). 🔴 `directory.pickupPoints[].method_id` — звірити
назву поля в `PickupPointRow` (`loaders/pickup-points.ts`); шапка serverFn
лишається тонкою (правило `server-fn-top-level`).

Run: `pnpm typecheck && pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`
Expected: PASS (7 кейсів).

- [ ] **Step 4: Клієнт — новий запит і мапа відмов**

`Checkout.tsx`: у `onSubmit` виклик `placeOrder({ data: {…} })` —
прибрати `shippingCost`, `items` → `items.map((item) => ({ productId:
item.productId, modificationId: item.modificationId, quantity: item.quantity }))`
(без `name/price/basePrice/discountData`); результат:

```ts
      const result = await placeOrder({ data: { … } });
      if (!result.ok) {
        // Код відмови — з сервера; текст — з каталогу (як CheckoutAuthBlock
        // мапить коди Better Auth).
        toast({
          title: t('checkout.failed'),
          description: t(`checkout.rejected.${result.reason}`),
          variant: 'destructive',
        });
        return;
      }
      const { order } = result;
```

(`clearCart`, toast успіху й `navigate` — без змін.) `CartItem.productId` —
`string`; якщо тип допускає порожній рядок — фільтрувати `items.filter((i) => i.productId)`.

Каталоги: у `uk/checkout.ts` після `'checkout.retry'`:

```ts
  // Доменні відмови оформлення — код із сервера, текст тут (К2-Е0)
  'checkout.rejected.shipping_unavailable': 'Обраний спосіб доставки недоступний — оберіть інший',
  'checkout.rejected.pickup_point_invalid': 'Оберіть точку видачі для цього способу доставки',
  'checkout.rejected.not_purchasable': 'Частина товарів у кошику зараз недоступна — перевірте кошик',
```

у `en/checkout.ts` — дзеркало: `'Selected shipping method is unavailable — pick another'`,
`'Pick a pickup point for this shipping method'`, `'Some items in your cart are unavailable — review the cart'`.

Run: `pnpm typecheck && pnpm test`
Expected: PASS (включно з `i18n-catalog-parity`).

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/storefront-routes/server packages/simplycms/src/storefront/loaders packages/simplycms/src/storefront-routes/pages/Checkout.tsx packages/simplycms/src/i18n/catalogs packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts
git commit -m "feat(k2-e0): placeOrder — сервер рахує ціни й доставку, відмовляє доменним кодом

Кошик несе лише id і кількість; ціна — resolvePrice+resolveDiscount, доставка
— resolveShippingRate у транзакції; метод/точка валідуються; результат —
union {ok, reason}, клієнт мапить код на каталог. Закриває борг 0.4.1-4
цілком; харнес доводить воронку до рядка в orders і три відмови (Е0-4)."
```

---

### Task 11: Чекаут — empty-state і видима валідація (Е0-4, UI)

**Files:**
- Modify: `packages/simplycms/src/checkout-ui/CheckoutDeliveryForm.tsx:195-225`
- Modify: `packages/simplycms/src/storefront-routes/pages/Checkout.tsx` (передати `canSubmit` у `CheckoutOrderSummary`; `FormMessage` для `shippingMethodId`)
- Modify: `packages/simplycms/src/checkout-ui/CheckoutOrderSummary.tsx:16-25, 115-119`
- Modify: `packages/simplycms/src/checkout-ui/CheckoutContactForm.tsx:31-70` (`id`/`htmlFor` чотирьох полів)
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts`
- Test: `packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx` (новий)

**Interfaces:**
- Produces: проп `CheckoutDeliveryFormProps.onAvailabilityChange?: (hasMethods: boolean) => void`; проп `CheckoutOrderSummaryProps.canSubmit: boolean`; i18n `checkout.noShippingMethods.title|description`.

- [ ] **Step 1: Юніт empty-state — спершу червоний**

`packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Довідник порожній — саме стан демо-магазину без доставки до К2-Е0:
// форма мовчала, а submit лишався активним (Е0-4).
vi.mock('simplycms/core/hooks/useShippingDirectory', () => ({
  useShippingDirectory: () => ({
    methods: [], pickupPoints: [], zones: [], rates: [], isLoading: false,
    rateFor: () => null,
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('simplycms/core/hooks/useAddressBook', () => ({
  useAddressBook: () => ({ addresses: [], save: vi.fn() }),
}));
vi.mock('simplycms/react-query', async (orig) => ({
  ...(await orig()),
  useEngine: () => ({ config: { locale: 'uk-UA', currency: 'UAH' } }),
}));

import { I18nProvider } from 'simplycms/i18n';
import { CheckoutDeliveryForm } from '../CheckoutDeliveryForm';

describe('CheckoutDeliveryForm без способів доставки', () => {
  it('показує empty-state і повідомляє батька, що submit неможливий', () => {
    const onAvailabilityChange = vi.fn();
    render(
      <I18nProvider locale="uk">
        <CheckoutDeliveryForm
          values={{}}
          onChange={vi.fn()}
          subtotal={100}
          onShippingCostChange={vi.fn()}
          onAvailabilityChange={onAvailabilityChange}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Доставка не налаштована')).toBeTruthy();
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx`
Expected: FAIL (тексту немає; пропа немає).

- [ ] **Step 2: Empty-state за патерном CartView + сигнал батькові**

У `CheckoutDeliveryForm.tsx`: додати проп `onAvailabilityChange?: (hasMethods: boolean) => void`;
ефект `useEffect(() => { onAvailabilityChange?.(methods.length > 0); }, [methods.length, onAvailabilityChange]);`
(поруч з автовибором); після гілки `if (methodsLoading) {…}` — перед основним `return`:

```tsx
  // 🔴 Порожній довідник — стан, у якому оформити замовлення НЕМОЖЛИВО, і
  // покупець мусить це бачити: до К2-Е0 сітка `methods.map` рендерилась
  // порожньою, поле для помилки валідації не існувало, а submit лишався
  // активним і мовчав. Той самий блокуючий патерн, що в CartView для
  // порожнього кошика.
  if (methods.length === 0) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Truck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {t('checkout.noShippingMethods.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('checkout.noShippingMethods.description')}
        </p>
      </div>
    );
  }
```

Каталоги: `uk` — `'checkout.noShippingMethods.title': 'Доставка не налаштована'`,
`'checkout.noShippingMethods.description': 'Магазин ще не додав жодного способу доставки. Оформлення стане доступним, щойно він зʼявиться.'`;
`en` — `'Shipping is not set up'`, `'The store has not added any shipping method yet. Checkout becomes available as soon as one appears.'`.

- [ ] **Step 3: Submit блокується; помилка `shippingRequired` видима**

`CheckoutOrderSummary.tsx`: проп `canSubmit: boolean` (в інтерфейс і деструктуризацію),
кнопка `disabled={isSubmitting || !canSubmit}`.

`Checkout.tsx`: `const [hasShippingMethods, setHasShippingMethods] = useState(true);`
→ `<CheckoutDeliveryForm … onAvailabilityChange={setHasShippingMethods} />`,
`<CheckoutOrderSummary … canSubmit={hasShippingMethods} />`. Під
`<CheckoutDeliveryForm …/>` — видима помилка поля, якого форма не рендерить:

```tsx
              <FormField
                control={form.control}
                name="shippingMethodId"
                render={() => (
                  <FormItem>
                    {/* Поля-радіо живуть у CheckoutDeliveryForm; повідомлення
                        `validation.shippingRequired` до К2-Е0 не мало де
                        зʼявитись — тому лише FormMessage. */}
                    <FormMessage />
                  </FormItem>
                )}
              />
```

(`FormField`, `FormItem`, `FormMessage` — з `simplycms/ui/form`, як у
`storefront-routes/components/SetPasswordForm.tsx:9-13`.)

Run: `pnpm vitest run packages/simplycms/src/checkout-ui packages/simplycms/src/storefront-routes && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3а: Поля контактів — `id` + `htmlFor` (доступність і селектори live-smoke)**

У `CheckoutContactForm.tsx` кожна пара `<label>`/`<input>` (імʼя, прізвище,
email, телефон) отримує звʼязок: `<label htmlFor="checkout-first-name" …>` і
`<input id="checkout-first-name" …>`; ідентифікатори — `checkout-first-name`,
`checkout-last-name`, `checkout-email`, `checkout-phone`. 🔴 Без цього
`getByLabel` Playwright і скрінрідери поля не знаходять (B5 аудиту r1); лейбл
без `htmlFor` над інпутом-сусідом — не звʼязок.

- [ ] **Step 4: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test
git add -A packages/simplycms/src/checkout-ui packages/simplycms/src/storefront-routes/pages/Checkout.tsx packages/simplycms/src/i18n/catalogs
git commit -m "feat(k2-e0): чекаут — empty-state без способів доставки, видима помилка, заблокований submit

Порожній довідник показує блокуючий стан (патерн CartView), submit вимкнено,
validation.shippingRequired рендериться через FormMessage (Е0-4)."
```

---

### Task 12: Кошик — `useSyncExternalStore` замість читання `localStorage` у рендері (Е0-5)

**Files:**
- Modify: `packages/simplycms/src/react-query/useCart.tsx:44-80, 130-150`
- Create: `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`
- Modify: `.github/instructions/optimization.instructions.md:54`

**Interfaces:**
- Produces: публічний API `useCart()` без змін (`items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, setIsOpen`).
- Consumes: нічого нового.

- [ ] **Step 1: Гідраційний негативний контроль — спершу червоний**

`packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`:

```tsx
// Гідраційний паритет кошика (К2-Е0, Е0-5). Сервер кошика не знає (він у
// localStorage), клієнт — знає з першого рендеру: до фіксу бейдж зʼявлявся
// в рендері гідратації як зайвий вузол → React #418 на кожній SSR-сторінці.
//
// 🔴 Дефолтне середовище vitest — node (без window): серверний прохід
// робиться в ньому, а DOM для клієнтського проходу ставиться вручну ПІСЛЯ
// (техніка `exposeDom` з packages/cli/src/theme-conformance-dom.mjs).
import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const STORED = JSON.stringify([
  { productId: 'p1', modificationId: null, name: 'A', price: 100, quantity: 2 },
]);

function exposeDom(window: JSDOM['window']): void {
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    Object.defineProperty(globalThis, key, { configurable: true, get: () => window[key as keyof typeof window] });
  }
  for (const [key, value] of Object.entries({
    window, self: window, document: window.document, navigator: window.navigator,
    localStorage: window.localStorage,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
}

describe('кошик: SSR-розмітка гідрується без розбіжностей при непорожньому localStorage', () => {
  it('нуль recoverable errors, бейдж зʼявляється ПІСЛЯ гідратації', async () => {
    const { CartProvider, useCart } = await import('../useCart');
    function Badge() {
      const { totalItems } = useCart();
      return totalItems > 0 ? <span data-badge="">{totalItems}</span> : null;
    }
    const tree = (
      <CartProvider>
        <div id="root"><Badge /></div>
      </CartProvider>
    );

    // 1. Сервер: window немає, кошик порожній.
    const html = renderToString(tree);
    expect(html).not.toContain('data-badge');

    // 2. Клієнт: DOM + непорожній localStorage до першого рендеру.
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: 'http://localhost/' });
    exposeDom(dom.window);
    window.localStorage.setItem('simplycms-cart', STORED);
    const { hydrateRoot } = await import('react-dom/client');
    const recoverable: unknown[] = [];
    const container = document.body;
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: (e) => recoverable.push(e) });
    });

    expect(recoverable, `React повідомив про розбіжність: ${recoverable.map(String).join('\n')}`).toEqual([]);
    expect(container.querySelector('[data-badge]')?.textContent).toBe('2');
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`
Expected: FAIL — `recoverable` містить помилку гідратації (React #418 /
«Hydration failed…»).

- [ ] **Step 2: Стор замість `useState` + ефектів**

У `useCart.tsx` замінити блок від `const CART_STORAGE_KEY` до кінця ефекту
збереження (рядки ~44–80) на:

```ts
const CART_STORAGE_KEY = 'simplycms-cart';
const EMPTY: readonly CartItem[] = [];

/**
 * Зовнішній стор кошика (К2-Е0, Е0-5) — за патерном `plugins/HookRegistry`.
 *
 * 🔴 Чому не `useState` з lazy-ініціалізатором: він читав localStorage у
 * ПЕРШОМУ клієнтському рендері, тобто в рендері гідратації; сервер віддавав
 * порожній кошик, клієнт — повний, і бейдж у шапці ставав зайвим DOM-вузлом
 * (React #418 на кожній SSR-сторінці з товаром у кошику).
 * `useSyncExternalStore` дає React серверний снапшот (порожньо) на гідратацію
 * і клієнтський — одразу після; бейдж зʼявляється без розбіжності.
 *
 * Снапшот кешується: `getSnapshot` мусить віддавати ту саму референцію, доки
 * стор не змінився — `JSON.parse` на кожен виклик дав би нескінченний рендер.
 * Перечитування localStorage — при переході 0→1 підписників (тести й
 * перемонтування) і на `storage`-подію (інша вкладка).
 */
let snapshot: readonly CartItem[] = EMPTY;
const listeners = new Set<() => void>();

const read = (): readonly CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as CartItem[];
    }
  } catch (e) {
    console.error('Failed to load cart from localStorage:', e);
  }
  return EMPTY;
};

const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== CART_STORAGE_KEY) return;
  snapshot = read();
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    snapshot = read();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
};
const getSnapshot = (): readonly CartItem[] => snapshot;
const getServerSnapshot = (): readonly CartItem[] => EMPTY;

const write = (next: readonly CartItem[]): void => {
  snapshot = next;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save cart to localStorage:', e);
  }
  listeners.forEach((l) => l());
};

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);
  const setItems = (update: (prev: readonly CartItem[]) => readonly CartItem[]) =>
    write(update(snapshot));
```

Далі `addItem`/`removeItem`/`updateQuantity`/`clearCart` без змін (вони
кличуть `setItems(prev => …)` — тепер це `write`); `items` у контексті —
`[...items]` або тип контексту `readonly CartItem[]`. Імпорт
`useSyncExternalStore` з `react`; прибрати `useEffect`, `useRef` з імпорту,
якщо більше не використовуються.

Run: `pnpm vitest run packages/simplycms/src/react-query packages/simplycms/src/storefront-routes/__tests__/cart-slots.test.tsx packages/simplycms/src/storefront-routes/__tests__/product-slots.test.tsx`
Expected: PASS (гідраційний тест зелений; тести слотів, що сідять
localStorage між рендерами, — зелені завдяки перечитуванню на 0→1).

- [ ] **Step 3: Інструкція — рецепт гідратації**

`.github/instructions/optimization.instructions.md:54`:
`- \`suppressHydrationWarning\` для елементів з різним SSR/client рендером (dark mode, cart count).`
→

```markdown
- Стан, якого сервер не знає (localStorage: кошик), читати через
  `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` з порожнім
  серверним снапшотом (зразок — `react-query/useCart.tsx`, `plugins/HookRegistry.ts`).
  🔴 Не `suppressHydrationWarning`: він гасить лише розбіжність атрибутів/тексту
  ОДНОГО елемента, а умовно присутній вузол (бейдж лічильника) дає React #418
  попри нього. Гейт — `react-query/__tests__/cart-hydration.test.tsx`.
```

- [ ] **Step 4: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
git add packages/simplycms/src/react-query/useCart.tsx packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx .github/instructions/optimization.instructions.md
git commit -m "fix(k2-e0): кошик на useSyncExternalStore — гідратація без React #418

Серверний снапшот порожній, клієнтський — після гідратації; перечитування
localStorage на 0→1 підписників і storage-подію. Негативний контроль:
renderToString → jsdom → hydrateRoot без recoverable errors. Рецепт в
optimization.instructions виправлено (Е0-5)."
```

---

### Task 13: Покупний демо-сід, ціна на головній, банери без файлів (Е0-6)

**Files:**
- Modify: `packages/simplycms/migrations/demo/demo-seed.sql` (шапка; секція 9; нова секція 10)
- Modify: `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts:21`
- Modify: `packages/simplycms/src/storefront/loaders/entities/home-product.ts`, `loaders/home.ts`, `loaders/home-sections.ts`, `storefront-routes/pages/home/{types,toCardViewModel}.ts`
- Sync: `pnpm template:sync` (копія сіду в шаблоні)

**Interfaces:**
- Produces: `HomeProductRow.price: number | null`, `HomeProductRow.old_price: number | null`; `loadHomeProducts(db, featuredOnly)` і `loadHomeSections…` заповнюють їх через `loadPricesByProduct` + `resolvePrice` за дефолтним типом ціни.
- Consumes: `loadPricesByProduct`, `loadDefaultPriceTypeId` (Task 10), `resolvePrice`.

- [ ] **Step 1: Пін детермінізму — спершу червоний**

У `seed-determinism.test.ts:21` `15` → `20` (пʼять нових `insert into` з явним
списком колонок: спосіб доставки, зона, точка видачі, тариф, залишки) і в
коментарі `:12` «15 у `demo/demo-seed.sql`» → «20».

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: FAIL (у файлі ще 15).

- [ ] **Step 2: Сід — доставка, точка, залишки, банери NULL**

У шапці `demo-seed.sql` (після абзацу «БЕЗ користувачів…») додати:

```sql
-- 🔴 К2-Е0 (2026-09-03): демо-магазин мусить бути ПОКУПНИМ — доходити до
-- рядка в `orders` живим прогоном (`pnpm live:smoke`). Тому тут є один
-- спосіб доставки, одна точка видачі й залишки для частини товарів (решта —
-- «статус без обліку»: обидві гілки правила наявності в одному сіді). Канон
-- `0003_seed.sql` доставки як не віз, так і не везе — її заводить магазин.
-- Зображень банерів у пакеті немає, тож `image_url` — NULL: тема малює
-- чесний стан без фото (рішення власника, HeroBanner «порожній круг»).
```

У секції 9 обидва `'/demo/banners/….jpg'` → `null`. Наприкінці файлу — секція 10:

```sql
-- ── 10. Доставка й залишки (К2-Е0): магазин, у якому можна купити ─────────
insert into public.shipping_methods (id, code, name, description, type, is_active, sort_order)
values ('1000000a-0000-4000-8000-000000000001'::uuid, 'pickup', 'Самовивіз',
        'Забрати зі складу у Києві', 'system', true, 0)
on conflict (code) do nothing;

-- 🔴 `shipping_rates.zone_id` — NOT NULL: одна дефолтна зона на всю країну;
-- `findShippingZoneIn` дефолтну зону пропускає, тож тариф застосовується без
-- прив'язки до міста (правило домену, не сіду).
insert into public.shipping_zones (id, name, description, is_active, is_default, sort_order)
values ('1000000e-0000-4000-8000-000000000001'::uuid, 'Україна', 'Дефолтна зона демо', true, true, 0)
on conflict (id) do nothing;

insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
values ('1000000b-0000-4000-8000-000000000001'::uuid,
        '1000000a-0000-4000-8000-000000000001'::uuid,
        'Склад у Києві', 'вул. Сонячна, 1', 'Київ', true, 0)
on conflict (id) do nothing;

insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
values ('1000000c-0000-4000-8000-000000000001'::uuid,
        '1000000a-0000-4000-8000-000000000001'::uuid,
        '1000000e-0000-4000-8000-000000000001'::uuid,
        'Безкоштовно зі складу', 'flat', 0, true, 0)
on conflict (id) do nothing;

-- Залишки лише для двох панелей: решта каталогу лишається «в наявності за
-- статусом без обліку» — так живий прогін бачить обидві гілки правила.
insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
select v.id, '1000000b-0000-4000-8000-000000000001'::uuid, p.id, null, v.quantity
from (
  values
    ('1000000d-0000-4000-8000-000000000001'::uuid, 'sonyachna-panel-450w-mono', 5),
    ('1000000d-0000-4000-8000-000000000002'::uuid, 'sonyachna-panel-550w-mono', 3)
) as v(id, product_slug, quantity)
join public.products p on p.slug = v.product_slug
on conflict (pickup_point_id, product_id) where product_id is not null and modification_id is null do nothing;
```

Звірено зі `schema.ts` (аудит r1 + верифікація): `shipping_methods_code_key`
(unique на `code`) існує → `on conflict (code)` коректний; `shipping_rates`:
`method_id`, `zone_id` (NOT NULL), `name`, `calculation_type`, `base_cost`,
`is_active`, `sort_order` — решта з дефолтами; предикат часткового індексу
`unique_stock_product_per_point` — `((product_id IS NOT NULL) AND
(modification_id IS NULL))`, форма `on conflict … where …` вище йому
відповідає. Пін у кроці 1 — **20**: рівно пʼять `insert into` цієї секції.

🔴 **Колізія з харнесом (B4 аудиту r1).** Демо-сід тепер везе `code='pickup'`,
а дві фікстури вставляють той самий код БЕЗ `on conflict` і котяться поверх
демо-сіду: `fixtures/storefront-client.ts:24` і `fixtures/showcase.ts:110-111`.
Правка в обох: `… values (gen_random_uuid(), 'pickup', 'Самовивіз', true) on
conflict (code) do nothing` — точки далі беруть метод `select … where code =
'pickup'`, тобто вже посилаються на сідовий рядок. `storefront-showcase.test.ts:252`
`expect(points).toBe(1)` → `toBe(2)` з коментарем «демо-точка + відкрита
фікстурна; закрита не рахується». Нові тести Tasks 9/10 уже вставляють з
`on conflict (code)`.

Run: `pnpm test:schema` (включно з `seed-determinism`, `demo-seed`,
`storefront-showcase`, `storefront-client-queries`, `order-stock`,
`checkout-flow` — усі читають демо-сід) і `pnpm template:sync && git status
--porcelain` (копія сіду в шаблоні оновилась; парність —
`tests/create-store-template-parity.test.ts`).
Expected: PASS; у дифі — `packages/create-simplycms-store/template/…/demo-seed.sql`.

- [ ] **Step 3: Ціна на головній — той самий мапер, що в каталозі**

`entities/home-product.ts`: у `HomeProductRow` додати `price: number | null;
old_price: number | null;`; `toHomeProduct(row, sectionSlug, price: ResolvedPrice)`
кладе `price: price.price, old_price: price.oldPrice`.

`loaders/home.ts::loadHomeProducts` (і той самий патерн у `home-sections.ts`):
після вибірки рядків —

```ts
  // Ціна — ТИМ САМИМ доменним резолвом, що в каталозі (`product-list-item`):
  // окремий MIN(price)-агрегат був би другим способом рахувати ціну.
  const prices = await loadPricesByProduct(db, rows.map((r) => r.id));
  const defaultPriceType = await loadDefaultPriceTypeId(db);
  return rows.map((row) =>
    toHomeProduct(row, row.section_slug,
      resolvePrice(prices[row.id] ?? [], defaultPriceType, defaultPriceType, null)),
  );
```

`pages/home/types.ts::HomeProduct` — `price: number | null; old_price: number | null;`;
`toCardViewModel.ts` — `price: product.price, old_price: product.old_price`, докблок
замінити на «Ціна приходить із лоадера головної тим самим резолвом, що в
каталозі (К2-Е0)». 🔴 Зняти посилання «звіт Ф1, ризик №4» — документа не існує.

Run: `pnpm typecheck && pnpm test`
Expected: PASS (тести головної, якщо є, — оновити фікстури `HomeProduct` полями `price/old_price`).

- [ ] **Step 4: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/migrations/demo packages/create-simplycms-store/template packages/simplycms/test-harness/pg/__tests__ packages/simplycms/src/storefront packages/simplycms/src/storefront-routes/pages/home
git commit -m "feat(k2-e0): покупний демо-сід (доставка, точка, залишки), ціна на головній, банери без фото

Демо доходить до рядка в orders; обидві гілки правила наявності в одному
сіді; пін детермінізму оновлено, копія в шаблоні синхронізована. Картки
головної отримують ціну тим самим resolvePrice, що каталог (Е0-6)."
```

---

### Task 14: Env-контракт як тест; тексти про `BETTER_AUTH_URL` (Е0-7)

**Files:**
- Create: `tests/env-contract.test.ts`
- Modify: `.env.example:36-40`, `CLAUDE.md` («Environment Variables»)

**Interfaces:** нічого; `auth/env.ts:47` НЕ змінюється (fallback на
`VITE_SITE_URL` спростовано — Додаток Б спеки).

- [ ] **Step 1: Тест-пін — спершу переконатись, що він зелений на чинних файлах**

`tests/env-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Пін контракту env магазину (К2-Е0, Е0-7): три документи (.env.example,
 * doctor, CLAUDE.md) уже розходились — карта стану показувала чотири ключі.
 * Машинно перевіряються два з них; CLAUDE.md — прозою, з посиланням сюди.
 */
const ROOT = resolve(import.meta.dirname, '..');
const CONTRACT = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'VITE_SITE_URL'] as const;
const SERVER_ONLY = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;

describe('контракт env магазину', () => {
  it('.env.example: активні ключі — рівно контракт', () => {
    const active = readFileSync(resolve(ROOT, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')[0]);
    expect(active.sort()).toEqual([...CONTRACT].sort());
  });

  it('doctor вимагає рівно серверну підмножину контракту', () => {
    const src = readFileSync(resolve(ROOT, 'packages/cli/src/doctor-checks.mjs'), 'utf8');
    const m = /const REQUIRED_ENV_VARS = \[([^\]]*)\]/.exec(src);
    expect(m, 'REQUIRED_ENV_VARS не знайдено').not.toBeNull();
    const required = m![1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(required.sort()).toEqual([...SERVER_ONLY].sort());
  });

  it('BETTER_AUTH_URL — опційний і задокументований як такий', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/^# BETTER_AUTH_URL=/m);
    expect(example).toMatch(/INVALID_ORIGIN/);
  });
});
```

Run: `pnpm vitest run tests/env-contract.test.ts`
Expected: третій кейс FAIL (у `.env.example` немає слова `INVALID_ORIGIN`), перші два — PASS.

- [ ] **Step 2: Тексти**

`.env.example` рядки 37–40 →

```
# Public base URL of the app — used for OAuth callbacks and links in emails.
# Optional in dev: without it Better Auth derives the base from the request
# (the startup WARN "Base URL is not set" is expected). Recommended in prod:
# with a string baseURL Better Auth trusts EXACTLY that origin and rejects
# others with 403 INVALID_ORIGIN — set it to the origin browsers really use.
# BETTER_AUTH_URL=https://your-domain.com
```

`CLAUDE.md`, «Environment Variables», пункт `BETTER_AUTH_SECRET`: після
«Опційний сусід — `BETTER_AUTH_URL` (без нього базовий URL береться із самого
запиту)» додати: «— у dev це очікуваний WARN Better Auth; у проді
`BETTER_AUTH_URL` рекомендований: з рядковим baseURL Better Auth довіряє рівно
цьому origin і відкидає інші з 403 `INVALID_ORIGIN`. Контракт стереже
`tests/env-contract.test.ts`».

Run: `pnpm vitest run tests/env-contract.test.ts`
Expected: PASS.

- [ ] **Step 3: Коміт**

```bash
pnpm format:check && pnpm lint && pnpm test
git add tests/env-contract.test.ts .env.example CLAUDE.md
git commit -m "test(k2-e0): пін контракту env (.env.example ↔ doctor); BETTER_AUTH_URL — опційний у dev, рекомендований у проді

Fallback baseURL на VITE_SITE_URL відкинуто (Better Auth довіряє рівно цьому
origin — дев на іншому порту отримав би 403). Три ключі — машинно (Е0-7)."
```

---

### Task 15: `scripts/live-smoke.mjs` — DoD як скрипт (Е0-8) + фінальна синхронізація

**Files:**
- Create: `scripts/live-smoke.mjs`
- Modify: `scripts/pilot-pack/build.mjs:74-80` (`startStore(storeDir, port, extraEnv = {})`)
- Modify: `package.json` (скрипт `live:smoke`)
- Modify: `CLAUDE.md` (Quick Reference: `live:smoke`; `db:demo` — покупний демо), `docs/architecture/test-contours.md` §12 (рядок «живий прогін = `pnpm live:smoke`»), `docs/tasks/v2-state-map.md` §2 (датований прогін), `docs/tasks/platform-roadmap.md` (К2-Е0 → ✅)

**Interfaces:**
- Consumes: `expectedProducts`, `gateHttp` з `scripts/pilot-pack/gate-b.mjs`; `startStore` з `scripts/pilot-pack/build.mjs`; `@playwright/test`.
- Produces: команда `PG_HARNESS_URL=… pnpm live:smoke` з нульовим кодом виходу на зеленому прогоні.

- [ ] **Step 0: `startStore` приймає явний env**

У `scripts/pilot-pack/build.mjs` сигнатура `startStore(storeDir, port)` →
`startStore(storeDir, port, extraEnv = {})`, а `env: { ...process.env, PORT:
String(port), HOST: '127.0.0.1' }` → `env: { ...process.env, ...extraEnv, PORT:
String(port), HOST: '127.0.0.1' }`. 🔴 Причина (M9 аудиту r1): `server.mjs`
наповнює `process.env` із `.env.local` лише для ВІДСУТНІХ ключів, тож
`DATABASE_URL` із shell чи CI перекрив би тестову БД, а прямий SQL скрипта
дивився б в іншу базу. Пілот викликає без третього аргумента — без змін.

- [ ] **Step 1: Скрипт**

`scripts/live-smoke.mjs`:

```js
#!/usr/bin/env node
/**
 * Живий прогін вітрини — DoD К2-Е0 як скрипт, не як таблиця (Е0-8).
 *
 * Що доводить і чим: (1) curl+SQL — той самий `gateHttp` пілота (SSR, sitemap,
 * robots, health, guard); (2) браузер — три речі, яких curl не бачить: нуль
 * `pageerror` з НЕПОРОЖНІМ кошиком, бейдж наявності після гідратації,
 * і сама воронка картка → кошик → чекаут → рядок в `orders` (+ списання).
 * Друкує таблицю — §12 test-contours.md посилається сюди замість рукопису.
 *
 * Потребує: Postgres (`PG_HARNESS_URL`, адмін-доступ до кластера — як
 * `pnpm db:demo`) і Chromium для Playwright (`pnpm exec playwright install
 * chromium` — on-demand, як jsdom для theme:conformance). Не CI — місце в
 * гейтах релізу (окреме рішення) і в К6 як Gate B на Postgres.
 *
 *   PG_HARNESS_URL=postgresql://user@127.0.0.1:5432/postgres pnpm live:smoke
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { startStore, freePort } from './pilot-pack/build.mjs';
import { gateHttp } from './pilot-pack/gate-b.mjs';

const ROOT = join(import.meta.dirname, '..');
const DB_NAME = 'simplycms_live_smoke';
const ENV_FILE = join(ROOT, '.env.local');
const ENV_BACKUP = join(ROOT, '.env.local.live-smoke.bak');

const adminUrl = process.env.PG_HARNESS_URL;
if (!adminUrl) throw new Error('[live-smoke] потрібен PG_HARNESS_URL (адмін-доступ до кластера, як для pnpm db:demo)');

const withDb = (url, name) => { const u = new URL(url); u.pathname = `/${name}`; return u.toString(); };
const sql = async (url, text, values = []) => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  try { return (await c.query(text, values)).rows; } finally { await c.end(); }
};

const rows = [];
const check = (label, passed, fact) => { rows.push([label, passed ? 'OK' : 'FAIL', fact]); };

/** Ідентифікатори полів контактної форми — `id`/`htmlFor` з CheckoutContactForm (Task 11). */
const FIELD = { firstName: '#checkout-first-name', lastName: '#checkout-last-name', phone: '#checkout-phone' };

async function main() {
  // 1. Чиста демо-БД (той самий скрипт, що й у доках).
  execFileSync('node', ['scripts/demo-db.mjs', '--url', adminUrl, '--name', DB_NAME], { cwd: ROOT, stdio: 'inherit' });
  const dbUrl = withDb(adminUrl, DB_NAME);
  const port = await freePort();
  // 🔴 Явний env для збірки й сервера: shell/CI можуть нести власні
  // DATABASE_URL/BETTER_AUTH_URL, а server.mjs бере .env.local лише для
  // відсутніх ключів (M9 аудиту r1).
  const env = {
    DATABASE_URL: dbUrl,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    VITE_SITE_URL: `http://127.0.0.1:${port}`,
  };

  let server;
  let browser;
  let envBackedUp = false;
  try {
    // 2. env рівно з контракту; оригінал відкладається й повертається у finally.
    if (existsSync(ENV_FILE)) { writeFileSync(ENV_BACKUP, readFileSync(ENV_FILE)); envBackedUp = true; }
    writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    server = await startStore(ROOT, port, env);
    const base = `http://127.0.0.1:${port}`;

    // 3. curl+SQL — гейт B пілота як є.
    const http = await gateHttp(port, { DATABASE_URL: dbUrl });
    for (const line of http.details) check('http', line.startsWith('OK'), line);

    // sitemap: кожен lastmod — W3C.
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
    check('sitemap lastmod W3C', lastmods.length > 0 && lastmods.every((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)), `${lastmods.length} url, зразок ${lastmods[0] ?? '—'}`);

    // 4. Браузер.
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const [product] = await sql(dbUrl, `select p.slug, s.slug as section, p.stock_status from public.products p join public.sections s on s.id = p.section_id where p.slug = 'sonyachna-panel-450w-mono'`);
    await page.goto(`${base}/catalog/${product.section}/${product.slug}`, { waitUntil: 'networkidle' });
    const badge = (await page.locator('text=/В наявності|Немає в наявності|Під замовлення/').first().textContent()) ?? '';
    check('бейдж = БД', product.stock_status === 'in_stock' ? badge.includes('В наявності') && !badge.includes('Немає') : true, `stock_status=${product.stock_status}, бейдж «${badge.trim()}»`);
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    check('JSON-LD availability', (jsonLd ?? '').includes('schema.org/InStock'), (jsonLd ?? '').match(/schema\.org\/\w+/)?.[0] ?? '—');

    await page.getByRole('button', { name: /Додати в кошик/ }).first().click();
    for (const path of ['/', '/catalog', '/cart', '/checkout']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    }
    check('pageerror з непорожнім кошиком', errors.length === 0, errors.length === 0 ? '0' : errors.join(' | '));

    // 5. Воронка до рядка в orders.
    const [{ c: before }] = await sql(dbUrl, `select count(*)::int as c from public.orders`);
    const [{ quantity: qtyBefore }] = await sql(dbUrl, `select quantity from public.stock_by_pickup_point s join public.products p on p.id = s.product_id where p.slug = $1`, [product.slug]);
    await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' });
    await page.locator(FIELD.firstName).fill('Тест');
    await page.locator(FIELD.lastName).fill('Покупець');
    await page.locator(FIELD.phone).fill('+380501234567');
    // Демо-метод — pickup з однією точкою: форма обирає метод автоматично,
    // точку — треба клікнути (перша й єдина).
    await page.getByRole('radio').first().check().catch(() => {});
    await page.getByRole('button', { name: /Підтвердити замовлення/ }).click();
    await page.waitForURL(/\/order-success\//, { timeout: 15_000 });
    const [{ c: after }] = await sql(dbUrl, `select count(*)::int as c from public.orders`);
    const [{ quantity: qtyAfter }] = await sql(dbUrl, `select quantity from public.stock_by_pickup_point s join public.products p on p.id = s.product_id where p.slug = $1`, [product.slug]);
    check('orders +1', after === before + 1, `${before} → ${after}`);
    const [{ value }] = await sql(dbUrl, `select value from public.system_settings where key = 'stock_management'`);
    check('списання залишку', value.decrease_on_order ? qtyAfter === qtyBefore - 1 : qtyAfter === qtyBefore, `decrease_on_order=${value.decrease_on_order}, ${qtyBefore} → ${qtyAfter}`);
  } finally {
    // 🔴 Один finally на все: браузер, сервер, env — у зворотному порядку;
    // падіння на будь-якому кроці не лишає ні процесів, ні чужого .env.local.
    await browser?.close().catch(() => {});
    server?.stop();
    if (envBackedUp) { writeFileSync(ENV_FILE, readFileSync(ENV_BACKUP)); rmSync(ENV_BACKUP); }
    else rmSync(ENV_FILE, { force: true });
  }

  console.log('\n| Перевірка | Результат | Факт |\n|---|---|---|');
  for (const [l, r, f] of rows) console.log(`| ${l} | ${r} | ${f} |`);
  const failed = rows.filter(([, r]) => r === 'FAIL').length;
  console.log(`\n${failed === 0 ? 'live-smoke: ЗЕЛЕНИЙ' : `live-smoke: ${failed} FAIL`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n[live-smoke] ${e.message}`); process.exit(1); });
```

Селектори полів — по `id` з Task 11 Step 3а (лейбли `CheckoutContactForm`
до того не мали `htmlFor`, і `getByLabel` їх не знаходив — B5 аудиту r1);
поле email або телефон — обовʼязкове одне з двох (телефон заповнюється).
Якщо `decrease_on_order` у демо `false` (канон `0003_seed`), рядок «списання»
очікує незмінний залишок — це чесно: сід канону тумблер не вмикає.

`package.json`: `"live:smoke": "node scripts/live-smoke.mjs",` (після `db:demo`).

- [ ] **Step 2: Прогін**

```bash
docker start simplycms-review-pg >/dev/null 2>&1 || true
pnpm exec playwright install chromium
PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres pnpm live:smoke
git status --porcelain
```

Expected: усі рядки `OK`, `live-smoke: ЗЕЛЕНИЙ`, код виходу 0; `.env.local`
відновлено; дерево — лише навмисні зміни задачі.

- [ ] **Step 3: Документи — один дотик**

- `CLAUDE.md` Quick Reference: рядок `pnpm live:smoke  # DoD К2-Е0: db:demo → build → server → curl+SQL (gate-b) + Playwright (кошик без #418, бейдж = БД, воронка до orders). Потребує Postgres і Chromium; не CI — гейти релізу окремим рішенням`; у рядку `pnpm db:demo` дописати «покупний демо (доставка, точка, залишки) з К2-Е0».
- `docs/architecture/test-contours.md` §12: у підрозділ «Живий прогін» першим абзацом — «Живий прогін = `pnpm live:smoke` (Е0-8): таблиця нижче — його вивід на дату, не рукопис; рядки додаються лише разом із перевіркою в скрипті» і вклеїти вивід прогону з кроку 2 з датою.
- `docs/tasks/v2-state-map.md` §2: новий підрозділ «2.2. К2-Е0 — підтверджено `pnpm live:smoke` <дата>» з тим самим виводом; §1 «Головне за 30 секунд» — речення про покупний демо-магазин.
- `docs/tasks/platform-roadmap.md`: етап К2-Е0 → `- [x] ✅ … ЗАВЕРШЕНО <дата>`; секція «Борги треку T» — T-1…T-5 → `✅ ЗАКРИТО <дата>`; борг 0.4.1-4 → `✅ ЗАКРИТО <дата> (К2-Е0 Е0-4)`.

- [ ] **Step 4: Повний ланцюг гейтів і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging && pnpm pilot:pack
git add scripts/live-smoke.mjs scripts/pilot-pack/build.mjs package.json CLAUDE.md docs/architecture/test-contours.md docs/tasks/v2-state-map.md docs/tasks/platform-roadmap.md
git commit -m "feat(k2-e0): live-smoke — DoD як скрипт; документи під живий прогін

curl+SQL через gate-b пілота + Playwright: кошик без React #418, бейдж
наявності = БД, JSON-LD, воронка до рядка в orders зі списанням. §12,
карта стану й роадмап посилаються на прогін, а не на рукопис (Е0-8)."
```

---

## Точка передачі

Після Task 15 — повернутись на валідацію з артефактами: вивід повного ланцюга
гейтів; вивід `pnpm pilot:pack` (з Gate IP); вивід `pnpm live:smoke`; `git log
--oneline main..HEAD`. Гілка НЕ мержиться без рішення власника — мерж у `main`
публікує пакети на npm.

Наступний план — **К3 Е2: Storage-мінімум** (роадмап, блок К3).
