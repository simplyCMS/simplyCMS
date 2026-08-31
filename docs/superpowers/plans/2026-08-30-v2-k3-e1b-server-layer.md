# V2-К3 · Етап Е1б: серверний шар адмінки і перша колекція

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дати адмінці серверний шар під `app_admin` і довести весь механізм на одній сутності наскрізь — від `defineAdminResource` до живої сторінки на `useLiveQuery` з оптимістичними мутаціями й машинними гейтами кеш-синхронізації.

**Architecture:** `admin-server` (T2) — єдиний, хто торкається БД: фабрика `defineAdminResource` віддає CRUD-serverFn під роллю `app_admin`, а операції з доменними інваріантами пишуться руками поруч. `admin-data` (T4) тримає колекції TanStack DB, memoізовані по `QueryClient`, із ключами з реєстру `ENTITY` (Е1а). Сторінка (T5) читає `useLiveQuery` і пише через колекцію, дістаючи оптимізм і авто-rollback від бібліотеки.

**Tech Stack:** `@tanstack/db` 0.8.6 + `@tanstack/react-db` 0.3.6 + `@tanstack/query-db-collection` 1.2.11 · TanStack Start 1.167 · TanStack Query 5.101 · Drizzle 0.45.2 + `drizzle-zod` 0.8.3 · Zod 4.4.3 · TypeScript 5.9 strict · Vitest 4

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — К3-2 (реєстр винятків), К3-4 (фабрика), К3-5 (режими), К3-7 (write-back), К3-8 (гейти), К3-9 (розкладка), К3-10 (peer); Додаток А-1…А-4, Б-1…Б-5

**Попередні етапи:** [Е0 — контракт id](2026-08-29-v2-k3-e0-id-contract.md) і [Е1а — ключі кешу](2026-08-30-v2-k3-e1a-cache-keys.md), обидва прийняті (HEAD `ddcff1ad`, 26 комітів, не запушено).

**Обсяг:** друга половина Е1. Після неї **одна сторінка адмінки жива** на чистому Postgres. Решта сутностей — Е3 (каталог on-demand) і Е4–Е6 (хвилі); storage — Е2.

🔴 **Головний ризик, успадкований з Е1а: гейт `entity-parity.test.ts` сліпий до ПОВНОТИ `deps`.** Він перевіряє лише, що названа залежність існує в `ENTITY` (`entity-parity.test.ts:59`), а не що список повний відносно коду лоадера. Сліпота вже пропустила дві реальні вади (`propertyOptionPage` мав 6 залежностей замість 9; `useCatalogProductsQuery` не мав жодної) — обидві спіймало ручне рев'ю. Цей етап будує інвалідацію **саме з `deps`**, тож неповний список = мовчазно неповна інвалідація, тобто рівно той клас багів, проти якого затіяно весь трек. Тому Task 1 — гейт повноти, і він іде **перед** усім.

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7.
- Коментарі й документація — **українською**; рядки інтерфейсу — тільки через i18n-каталоги.
- `pnpm lint` = **0 errors**, 12 warnings — чинна лінія, не зрушувати.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`.
- `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки `package.json`.
- Тіри: `admin-server` = **T2** (поруч із `db`/`auth`), `admin-data` = **T4**, `admin` = T5. Імпорт угору заборонений; дві нові зони в `eslint.tier-zones.mjs` + негативний контроль у `tests/tier-boundary.test.ts`.
- 🔴 **Модуль поруч із serverFn не має живих не-serverFn експортів.** Трансформація Start вирізає тіла `createServerFn`-хендлерів, і їхні серверні імпорти зникають; звичайна функція такого імунітету не має і затягує drizzle та пул Postgres у клієнтський бандл. Спіймано Gate C пілота (`storefront-routes/server/is-admin.ts:17-26`). Усе, що потрібне і клієнту, і серверу, — окремим модулем під bare-специфікатором.
- 🔴 **`queryKey` колекції — той самий ключ, що в решти запитів** (`entityKey`/`AGGREGATE` з Е1а). Похідні ключі мусять розширювати базовий як префікс, інакше оновлення кешу проминає записи (спека, Додаток Б-2).
- 🔴 **Write-back замість self-invalidation:** persistence-хендлер пише результат сервера через `writeUpsert` і повертає `{ refetch: false }`. Інвалідація власного ключа — заборонений антипатерн (зайвий GET + вікно гонки).
- `id` для Категорії A генерує клієнт (`crypto.randomUUID()`); fail-loud при `serverRow.id !== optimisticId`.
- Кожен гейт має **негативний І позитивний** контроль, прогнаний вручну.
- Коміти українською, `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Передумова оточення

```bash
export PG_HARNESS_URL='postgresql://pgtest@127.0.0.1:55433/postgres'
node -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.PG_HARNESS_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('OK');return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

🔴 Тести з `test-harness/**` — **тільки** через
`pnpm vitest run --config vitest.schema.config.ts <path>`; кореневий конфіг
цю теку виключає. Локальних `initdb`/`pg_ctl` немає, стенд — контейнер
`simplycms-041-pg` (знімок 2026-08-30, не контракт).

---

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts` | **Гейт повноти `deps`**: перехоплює фактичний SQL лоадера |
| `packages/simplycms/src/admin-server/index.ts` | T2. Барель — **лише serverFn** |
| `packages/simplycms/src/admin-server/subset.ts` | `loadSubsetOptions` → Drizzle `where`/`orderBy` з allowlist |
| `packages/simplycms/src/admin-server/resource.ts` | `defineAdminResource` — фабрика CRUD |
| `packages/simplycms/src/admin-server/resources/order-statuses.ts` | Перший ресурс |
| `packages/simplycms/src/admin-server/operations/order-status-default.ts` | Іменована операція з інваріантом |
| `packages/simplycms/src/admin-data/registry.ts` | T4. `WeakMap<QueryClient, …>` + `useCollection` |
| `packages/simplycms/src/admin-data/collections/order-statuses.ts` | Перша колекція |
| `packages/simplycms/src/runtime/router-context.ts` | Тип `RouterContext` у пакеті (борг Е1а) |
| `packages/simplycms/src/auth/authz-request.ts` | `assertAllowed` — склейка `readSessionSubject` + `can` (не існує сьогодні) |
| `eslint-rules/mutation-cache-sync.mjs` | Друге кастомне правило |
| `tests/handler-canon.test.ts` | AST-гейт write-back у persistence-хендлерах |
| `packages/simplycms/src/admin-server/__tests__/*.test.ts` | Юніти фабрики, subset, id-mismatch |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/package.json` | peer TanStack DB (3 пакети) + **dep `drizzle-zod`**; exports+publishConfig `./admin-server`, `./admin-data`, `./runtime/router-context` |
| `packages/simplycms/tsup.config.ts` | профілі двох нових тек (явні патерни) |
| `eslint.tier-zones.mjs` | дві нові зони (T2, T4) |
| `eslint.config.mjs` | підключення `mutation-cache-sync` |
| `packages/simplycms/src/admin/pages/OrderStatuses.tsx` | на `useLiveQuery` + колекцію |
| `src/routes/__root.tsx` (+ канон, шаблон через `template:sync`) | `RouterContext` реекспортом із пакета |
| `packages/create-simplycms-store/template/package.json.tpl` | пін `@tanstack/react-db` |
| `tests/tier-boundary.test.ts` | негативний контроль двох нових зон |

**Свідомо НЕ чіпаються:** решта 52 файлів `src/admin/**` — вони переходять хвилями Е3–Е6. Ратчет `admin-inserts-need-id` і виїмка `admin/` у правилі ключів лишаються чинними до кінця переписування.

---
# Частина 1 — передумови

### Task 1: Гейт повноти `deps` — перехоплення фактичного SQL

**Files:**
- Create: `packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts`
- Modify: `packages/simplycms/src/contracts/entities.ts` (якщо виявиться неповний `deps`)

**Interfaces:**
- Consumes: `AGGREGATE` з `simplycms/contracts/entities` (Е1а), харнес `resolveHarness`/`applySqlFiles`.
- Produces: доказ, що `deps` кожного агрегату **повний** — на ньому Task 8 будує інвалідацію.

🔴 **Чому рантайм, а не статичний аналіз.** Наявний гейт перевіряє лише
існування названої залежності. Статично довести повноту не вийде:
`loadProductsByOption` делегує в спільний `loadCatalogProductsWhere`, той
— ще глибше, і саме на транзитивності гейт Е1а й осліп (`propertyOptionPage`
мав 6 залежностей замість 9). Виконаний запит бреше значно менше за
граф викликів: у SQL видно фактичні таблиці, включно з делегуванням,
аліасами й динамікою.

🔴 Перехоплення робиться на рівні `pg`, а не drizzle-логера: `withActor`
створює drizzle сам (`db/with-actor.ts:57`), логера туди не підсунути без
правки продакшн-коду. Spy на `Client.prototype.query` бачить і преамбулу
актора, і всі запити транзакції.

✅ **Техніку перевірено наживо** (2026-08-30, стенд `55433`): підміна
`pg.Client.prototype.query` перехопила всі три запити, що пішли через
`pool.connect()` → `client.query`, включно з `begin`/`commit`. Тобто
`PoolClient` успадковує прототип `Client`, і spy на ньому працює.

- [ ] **Step 1: Написати гейт**

```ts
// packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import pg from 'pg';
import { AGGREGATE, ENTITY } from 'simplycms/contracts/entities';
import { resolveHarness } from '../up.mjs';
import { applySqlFiles, createTempDatabase, dropTempDatabase, randomDbName, withDbName } from '../apply.mjs';

const CANON = join(import.meta.dirname, '../../../migrations');
const canonFiles = () =>
  readdirSync(CANON).filter((n) => n.endsWith('.sql')).sort().map((n) => join(CANON, n));

/**
 * Імена таблиць, які реально згадав SQL.
 *
 * 🔴 Межі перевірені на реальних формах Drizzle (прогін 2026-08-30):
 * ловить `from`/`join` з лапками й без, у підзапитах і після CTE.
 * НЕ ловить:
 *   • `insert into "orders"` — свідомо: агрегати описують ЧИТАННЯ, і
 *     запис у них не входить (за записом стежить `explicit-ids`);
 *   • кома-розділені таблиці `from a, b` — Drizzle такої форми не
 *     генерує, але якщо колись зʼявиться сирий SQL із нею, друга
 *     таблиця пройде повз.
 * Тобто гейт ловить рівно те, заради чого існує, і не вдає більшого.
 */
function tablesInSql(sql: string): string[] {
  const re = /\b(?:from|join)\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

/**
 * Як викликати кожен агрегат. 🔴 Реєстр РУЧНИЙ і це навмисно: він і є
 * місцем, де автор агрегату свідомо каже «ось так воно виконується».
 * Агрегат без запису тут — провал гейта, а не мовчазний пропуск.
 */
const INVOCATIONS: Record<keyof typeof AGGREGATE, () => Promise<unknown>> = {
  shippingDirectory: async () => {
    const m = await import('simplycms/storefront/loaders');
    return m.loadShippingDirectory();
  },
  // …решта агрегатів — по одному рядку. Аргументи брати такі, щоб запит
  // реально виконався (id із сіду, який накочується нижче).
};

describe('Е1б: deps агрегатів повні відносно фактичного SQL', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_aggregate_deps');
  let dbUrl: string;
  const seen = new Set<string>();
  let restore: (() => void) | null = null;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = dbUrl;

    const original = pg.Client.prototype.query;
    const spy = vi
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation(function (this: pg.Client, ...args: unknown[]) {
        const first = args[0] as string | { text?: string };
        const sql = typeof first === 'string' ? first : first?.text;
        if (sql) for (const t of tablesInSql(sql)) seen.add(t);
        return (original as never).apply(this, args as never);
      });
    restore = () => spy.mockRestore();
  }, 180_000);

  afterEach(() => seen.clear());
  afterAll(async () => {
    restore?.();
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('кожен агрегат має запис у реєстрі викликів', () => {
    // Інакше новий агрегат тихо лишиться поза перевіркою.
    expect(Object.keys(INVOCATIONS).sort()).toEqual(Object.keys(AGGREGATE).sort());
  });

  it.each(Object.keys(AGGREGATE) as (keyof typeof AGGREGATE)[])(
    '%s: deps покривають усі прочитані таблиці',
    async (name) => {
      seen.clear();
      await INVOCATIONS[name]();

      const declared = new Set<string>(AGGREGATE[name].deps);
      const known = new Set<string>(Object.values(ENTITY));
      // Службові таблиці поза ENTITY (напр. auth) до deps не належать.
      const missing = [...seen].filter((t) => known.has(t) && !declared.has(t)).sort();

      expect(
        missing,
        `${name}: SQL читає таблиці, яких немає в deps — інвалідація буде ` +
          `неповною: ${missing.join(', ')}`,
      ).toEqual([]);
    },
  );

  it('перехоплення взагалі працює', async () => {
    // Захист від зеленого гейта через зламаний spy: після виклику
    // будь-якого агрегату множина не може бути порожньою.
    seen.clear();
    await INVOCATIONS[Object.keys(AGGREGATE)[0] as keyof typeof AGGREGATE]();
    expect(seen.size).toBeGreaterThan(0);
  });
});
```

🔴 Якщо лоадер потребує даних — накотити демо-сід
(`migrations/demo/demo-seed.sql`) у `beforeAll` після канону. Порожній
результат гейт не турбує: важливо, ЩО запитано, а не що повернулось.

- [ ] **Step 2: Запустити й виміряти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts`
Expected: або PASS (усі `deps` повні), або FAIL із переліком таблиць.
🔴 **FAIL тут — успіх гейта, а не привід послабити його.** Дописати
відсутні таблиці в `deps` агрегату й перезапустити.

- [ ] **Step 3: Негативний контроль**

```bash
# Тимчасово прибрати одну залежність із будь-якого агрегату в
# packages/simplycms/src/contracts/entities.ts (напр. ENTITY.products
# зі stockInfo), потім:
pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts
# Expected: FAIL — 'stockInfo: SQL читає таблиці, яких немає в deps: products'
# Повернути залежність → PASS
```

🔴 Без цього кроку гейт не доведений: саме така сліпота в Е1а пройшла
повз чотири зелені кейси.

- [ ] **Step 4: Коміт**

```bash
git add packages/simplycms/test-harness packages/simplycms/src/contracts
git commit -m "test(v2-k3): гейт повноти deps — перехоплення фактичного SQL

Гейт Е1а перевіряв лише існування названої залежності, не повноту
списку, і вже пропустив дві реальні вади (propertyOptionPage 6 замість
9; useCatalogProductsQuery без deps) — обидві спіймало ручне рев'ю.
Е1б будує інвалідацію саме з deps, тож неповний список дав би мовчазно
неповну інвалідацію.

Статичний аналіз тут безсилий (делегування через
loadCatalogProductsWhere), тому перевірка рантаймова: spy на
pg.Client.prototype.query бачить фактичний SQL транзакції.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `@tanstack/react-db` як peer + пін у шаблоні

**Files:**
- Modify: `packages/simplycms/package.json` (peerDependencies + devDependencies)
- Modify: `packages/create-simplycms-store/template/package.json.tpl`
- Test: `tests/template-deps-parity.test.ts` (наявний або новий — перевірити)

**Interfaces:**
- Produces: `@tanstack/db`, `@tanstack/react-db`, `@tanstack/query-db-collection` доступні ядру й магазину.

🔴 **Peer, не dependency** (рішення К3-10): `@tanstack/react-db` — `0.3.x`,
і як пряма залежність ядра його breaking changes їхали б у магазини
разом із нашим релізом. Форма — та сама, що вже вживається для
`@tanstack/react-query` (`package.json:493`).

- [ ] **Step 1: Подивитись, як оформлено наявний peer**

```bash
python3 -c "
import json;d=json.load(open('packages/simplycms/package.json'))
print('peer:', json.dumps({k:v for k,v in d['peerDependencies'].items() if 'tanstack' in k}, indent=1))
print('dev :', json.dumps({k:v for k,v in d.get('devDependencies',{}).items() if 'tanstack' in k}, indent=1))"
grep -n "tanstack" packages/create-simplycms-store/template/package.json.tpl
```

- [ ] **Step 2: Додати трійку**

У `peerDependencies` ядра — те саме формулювання, що в сусідів:
```json
"@tanstack/db": "^0.8.0",
"@tanstack/query-db-collection": "^1.2.0",
"@tanstack/react-db": "^0.3.0"
```

🔴 **І `drizzle-zod` — його теж немає в дереві** (перевірено: нуль у
`node_modules/.pnpm` і в манифестах). Він потрібен Task 5 для виведення
Zod-схем зі схеми Drizzle. Але це **не** peer: його вживає лише
серверний код ядра, магазин про нього не знає. Тому — у
`dependencies` пакета:
```json
"drizzle-zod": "^0.8.3"
```
Сумісність перевірена: його peer — `drizzle-orm >=0.36.0` і
`zod ^3.25.0 || ^4.0.0`; у нас `0.45.2` і `4.4.3`.
У `devDependencies` ядра — ті самі пакети точними версіями (щоб монорепо
збиралось), у `template/package.json.tpl` — пін, як у решти залежностей
шаблону.

```bash
pnpm install   # оновити lockfile — БЕЗ --frozen-lockfile, ми міняли манифести
```

- [ ] **Step 3: Гейти**

```bash
pnpm install --frozen-lockfile && pnpm test && pnpm lint
```
Expected: PASS. 🔴 `--frozen-lockfile` тут обовʼязковий: він єдиний
доводить, що lockfile перегенеровано (урок PR #20).

- [ ] **Step 4: Коміт**

```bash
git add packages/simplycms/package.json packages/create-simplycms-store/template pnpm-lock.yaml
git commit -m "chore(v2-k3): TanStack DB як peer-залежність + пін у шаблоні

react-db на 0.3.x: як пряма залежність ядра його breaking changes їхали
б у магазини з нашим релізом. Форма та сама, що для react-query.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Тип `RouterContext` переїжджає в пакет

**Files:**
- Create: `packages/simplycms/src/runtime/router-context.ts`
- Modify: `src/routes/__root.tsx` (+ канон і шаблон через `template:sync`)
- Modify: `packages/simplycms/package.json` (обидві exports-мапи)
- Modify: `packages/simplycms/tsup.config.ts`

**Interfaces:**
- Produces: `RouterContext` імпортовний з `simplycms/runtime/router-context` — щоб `loader` роут-файлів **ядра** міг типізувати `context.queryClient`.

🔴 Борг Е1а: тип живе в host-файлі `src/routes/__root.tsx:53`, тож роути
ядра його не бачать. Task 9 ставить `loader` у роут-файл адмінки — без
переїзду він не типізується.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/src/runtime/__tests__/router-context.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { RouterContext } from '../router-context';

describe('RouterContext доступний із пакета', () => {
  it('несе queryClient', () => {
    expectTypeOf<RouterContext>().toHaveProperty('queryClient');
    expectTypeOf<RouterContext['queryClient']>().toEqualTypeOf<QueryClient>();
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/runtime/__tests__/router-context.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 2: Створити модуль**

```ts
// packages/simplycms/src/runtime/router-context.ts
import type { QueryClient } from '@tanstack/react-query';

/**
 * Контекст роутера магазину.
 *
 * 🔴 Живе в ПАКЕТІ, а не в host-файлі: `loader` роут-файлів ядра
 * (`routes/admin/**`) типізує `context.queryClient` саме звідси, а
 * дотягтись до `src/routes/__root.tsx` магазину вони не можуть — це
 * зворотний напрям залежності. Host лише реекспортує цей тип.
 */
export interface RouterContext {
  readonly queryClient: QueryClient;
}
```

- [ ] **Step 3: Host реекспортує**

```tsx
// src/routes/__root.tsx — замість власного оголошення
import type { RouterContext } from 'simplycms/runtime/router-context';

export type { RouterContext };

export const Route = createRootRouteWithContext<RouterContext>()({
  // …без змін
});
```

- [ ] **Step 4: Оголосити субшлях в ОБИДВІ мапи + tsup**

`exports`: `"./runtime/router-context": "./src/runtime/router-context.ts"`
`publishConfig.exports`: `{ "types": "./dist/runtime/router-context.d.ts", "import": "./dist/runtime/router-context.js" }`
🔴 Обидві обовʼязкові — `audit-exports` вимагає publish-запис окремо.
У `tsup.config.ts` — явний патерн `src/runtime/router-context.ts`
(глоби профілю матчать лише `index.ts`).

- [ ] **Step 5: Синхронізувати й прогнати**

```bash
pnpm template:sync
pnpm build && pnpm typecheck && pnpm test && pnpm build:packages && pnpm test:packaging
```
Expected: PASS. 🔴 `build` перед `typecheck` — він генерує `routeTree.gen.ts`.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms src packages/cli/host packages/create-simplycms-store/template
git commit -m "feat(v2-k3): RouterContext переїжджає в пакет

Борг Е1а: тип жив у host-файлі, тож роути ядра його не бачили. Task 9
ставить loader у роут адмінки — без переїзду він не типізується. Host
тепер лише реекспортує.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
# Частина 2 — серверний шар

### Task 4: Тека `admin-server`, тір-зона і `subset.ts`

**Files:**
- Create: `packages/simplycms/src/admin-server/index.ts`, `subset.ts`
- Create: `packages/simplycms/src/admin-server/__tests__/subset.test.ts`
- Modify: `eslint.tier-zones.mjs`, `tests/tier-boundary.test.ts`
- Modify: `packages/simplycms/package.json` (обидві мапи), `tsup.config.ts`

**Interfaces:**
- Produces: `toDrizzleSubset(table, allow, opts)` → `{ where, orderBy, limit, offset }` для Drizzle; кидає на колонку поза allowlist.

🔴 `subset.ts` — **єдина причина існування фабрики**. Трансляція
`{field, operator, value}[]` у SQL мусить жити в одному місці з
allowlist колонок; написана 34 рази вона дає 34 шанси на інʼєкцію. Той
самий мотив, з якого в `plugin-sdk/server/guard.ts` живуть
`assertColumn`/`assertOwnTable`.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/src/admin-server/__tests__/subset.test.ts
import { describe, expect, it } from 'vitest';
import { orderStatuses } from 'simplycms/schema';
import { toDrizzleSubset } from '../subset';

const ALLOW = { filterable: ['code', 'isDefault'], sortable: ['sortOrder'] } as const;

describe('subset: трансляція loadSubsetOptions у Drizzle', () => {
  it('колонка поза allowlist — кидає', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        filters: [{ field: ['name'], operator: 'eq', value: 'x' }],
      }),
    ).toThrow(/name/);
  });

  it('сортування поза allowlist — кидає', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        sorts: [{ field: ['createdAt'], direction: 'asc' }],
      }),
    ).toThrow(/createdAt/);
  });

  it('дозволена колонка проходить', () => {
    const s = toDrizzleSubset(orderStatuses, ALLOW, {
      filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
      sorts: [{ field: ['sortOrder'], direction: 'asc' }],
      limit: 10,
    });
    expect(s.where).toBeDefined();
    expect(s.limit).toBe(10);
  });

  it('порожні опції — порожній subset, не помилка', () => {
    // On-demand колекція може попросити все: це легальний стан.
    expect(toDrizzleSubset(orderStatuses, ALLOW, {}).where).toBeUndefined();
  });

  it('невідомий оператор — кидає, а не ігнорується мовчки', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        filters: [{ field: ['code'], operator: 'like' as never, value: 'x' }],
      }),
    ).toThrow(/like/);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/subset.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 2: Написати `subset.ts`**

```ts
// packages/simplycms/src/admin-server/subset.ts
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, type SQL } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';

/**
 * Трансляція предикатів колекції у Drizzle — з allowlist колонок.
 *
 * 🔴 Єдине місце, де рядок із клієнта стає частиною SQL. `field`
 * звіряється з дозволеним списком РЕСУРСУ (не зі схемою: дозволити
 * фільтр по всіх колонках означало б віддати клієнту повний доступ до
 * форми запиту), значення завжди йде параметром Drizzle.
 *
 * Оператори — рівно ті, що вміє push-down query-collection
 * (`parseLoadSubsetOptions`): eq, gt, gte, lt, lte, in, and, or.
 * Невідомий оператор КИДАЄ: мовчазне ігнорування віддало б клієнту
 * ширший набір рядків, ніж він просив.
 */
const OPERATORS = { eq, gt, gte, lt, lte, in: inArray } as const;

export interface SubsetAllow {
  readonly filterable: readonly string[];
  readonly sortable: readonly string[];
}

export interface SubsetInput {
  filters?: readonly { field: readonly string[]; operator: string; value: unknown }[];
  sorts?: readonly { field: readonly string[]; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export function toDrizzleSubset(table: Table, allow: SubsetAllow, input: SubsetInput) {
  const columns = table as unknown as Record<string, never>;

  const conditions: SQL[] = (input.filters ?? []).map((f) => {
    const name = f.field.join('.');
    if (!allow.filterable.includes(name)) {
      throw new Error(`[admin-server] фільтр по недозволеній колонці: ${name}`);
    }
    const op = OPERATORS[f.operator as keyof typeof OPERATORS];
    if (!op) throw new Error(`[admin-server] невідомий оператор: ${f.operator}`);
    return op(columns[name], f.value as never);
  });

  const orderBy = (input.sorts ?? []).map((s) => {
    const name = s.field.join('.');
    if (!allow.sortable.includes(name)) {
      throw new Error(`[admin-server] сортування по недозволеній колонці: ${name}`);
    }
    return (s.direction === 'desc' ? desc : asc)(columns[name]);
  });

  return {
    where: conditions.length === 0 ? undefined : and(...conditions),
    orderBy: orderBy.length === 0 ? undefined : orderBy,
    limit: input.limit,
    offset: input.offset,
  };
}
```

🔴 `or` імпортовано, але поки не вживається — його ввімкне Е3 разом із
складнішими фільтрами каталогу. Якщо лінт свариться на невживаний
імпорт — прибрати й повернути в Е3.

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/subset.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 3: Тір-зона T2**

У `eslint.tier-zones.mjs`, поруч із `['src/db', 2, 'db', []]`:

```js
// Серверний шар адмінки (Е1б) — T2 поруч із `db`/`auth`: він теж
// говорить із БД і теж стоїть над схемою. `db` у винятку `upward` —
// єдиний канал до Postgres (`withActor`), як і в `auth`.
['src/admin-server', 2, 'admin-server', ['db']],
```

У `tests/tier-boundary.test.ts` — негативний контроль: імпорт із
`admin-server` у щось вище тіру має валити лінт.

- [ ] **Step 4: Барель — лише serverFn**

```ts
// packages/simplycms/src/admin-server/index.ts
/**
 * Публічна поверхня серверного шару адмінки.
 *
 * 🔴 Тут ЛИШЕ serverFn. Живий не-serverFn експорт поруч із ними тягне
 * drizzle і пул Postgres у клієнтський бандл: трансформація Start
 * вирізає тіла хендлерів `createServerFn`, і їхні серверні імпорти
 * зникають, а звичайна функція такого імунітету не має. Спіймано Gate C
 * (`storefront-routes/server/is-admin.ts:17-26`).
 *
 * `subset.ts` і `resource.ts` НЕ реекспортуються — вони внутрішні.
 */
export * from './resources/order-statuses';
export * from './operations/order-status-default';
```

- [ ] **Step 5: Субшлях, tsup, гейти**

Обидві exports-мапи (`./admin-server`), явний патерн у профілі tsup.

```bash
pnpm lint && pnpm test && pnpm build:packages && pnpm test:packaging
```
Expected: PASS, 0 errors.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms eslint.tier-zones.mjs tests/tier-boundary.test.ts
git commit -m "feat(v2-k3): admin-server (T2) + subset із allowlist колонок

subset — єдина причина існування фабрики: трансляція предикатів
колекції у SQL мусить жити в одному місці з allowlist, написана 34 рази
вона дала б 34 шанси на інʼєкцію. Невідомий оператор кидає, а не
ігнорується мовчки.

Барель тримає лише serverFn — інакше tsup тягне drizgle і пул у
клієнтський бандл (урок Gate C).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `defineAdminResource`

**Files:**
- Create: `packages/simplycms/src/admin-server/resource.ts`
- Create: `packages/simplycms/src/admin-server/__tests__/resource.test.ts`

**Interfaces:**
- Produces: `defineAdminResource(config)` → `{ list, insert, update, remove }` (serverFn) + `{ rowSchema, insertSchema, updateSchema }` (Zod з `drizzle-zod`).

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/src/admin-server/__tests__/resource.test.ts
import { describe, expect, it, vi } from 'vitest';
import { orderStatuses } from 'simplycms/schema';
import { defineAdminResource } from '../resource';

vi.mock('simplycms/storefront/loaders', () => ({
  withStoreOperatorDb: vi.fn(async (fn) => fn({} as never)),
}));

const resource = defineAdminResource({
  entity: 'order_statuses',
  table: orderStatuses,
  operation: 'catalog.write',
  filterable: ['code'],
  sortable: ['sortOrder'],
  writable: ['name', 'code', 'color', 'sortOrder', 'isDefault'],
  readonly: ['id', 'createdAt'],
});

describe('defineAdminResource', () => {
  it('insertSchema вимагає id — ключ генерує клієнт', () => {
    // 🔴 Контракт Е0: без id оптимістичний рядок і серверний розійдуться.
    const parsed = resource.insertSchema.safeParse({ name: 'X', code: 'x' });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/id/);
  });

  it('insertSchema не приймає readonly-колонок', () => {
    const parsed = resource.insertSchema.safeParse({
      id: crypto.randomUUID(), name: 'X', code: 'x', createdAt: '2026-01-01',
    });
    // createdAt зрізається або відхиляється — головне, щоб не доїхав у БД.
    expect(parsed.success ? 'createdAt' in parsed.data : true).toBe(false);
  });

  it('віддає чотири операції', () => {
    for (const op of ['list', 'insert', 'update', 'remove'] as const) {
      expect(typeof resource[op], `${op} відсутній`).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/resource.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 3: Написати фабрику**

```ts
// packages/simplycms/src/admin-server/resource.ts
import { createServerFn } from '@tanstack/react-start';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { eq, type Table } from 'drizzle-orm';
import { z } from 'zod';
import { withStoreOperatorDb } from 'simplycms/storefront/loaders';
import { assertAllowed } from 'simplycms/auth';
import { toDrizzleSubset, type SubsetAllow } from './subset';

/**
 * Фабрика CRUD-serverFn ресурсу адмінки (рішення К3-4).
 *
 * 🔴 Розріз «фабрика vs ручна операція» проходить ПО ОПЕРАЦІЯХ, не по
 * сутностях: `order_statuses` бере тут `list/insert/update/remove`, а
 * `setDefault` (він знімає прапорець з інших) живе окремим модулем.
 * Критерій простий — чи має операція доменний інваріант, якого фабрика
 * знати не може.
 *
 * 🔴 DSL запитів тут свідомо НЕМАЄ: жодних вкладених фільтрів, `or`,
 * підзапитів. Усе складніше — це `useLiveQuery` на клієнті або іменована
 * операція. Саме це тримає фабрику в межах, за якими вона не стає
 * «фреймворком усередині фреймворка».
 */
export function defineAdminResource<T extends Table>(config: {
  entity: string;
  table: T;
  operation: Parameters<typeof assertAllowed>[1];
  filterable: readonly string[];
  sortable: readonly string[];
  writable: readonly string[];
  readonly: readonly string[];
  defaultOrder?: { column: string; direction: 'asc' | 'desc' };
}) {
  const allow: SubsetAllow = {
    filterable: config.filterable,
    sortable: config.sortable,
  };

  const rowSchema = createSelectSchema(config.table);
  // 🔴 `id` обовʼязковий: ключ генерує клієнт (контракт Е0).
  const insertSchema = createInsertSchema(config.table)
    .pick(Object.fromEntries(config.writable.map((c) => [c, true])) as never)
    .extend({ id: z.string().uuid() });
  const updateSchema = createUpdateSchema(config.table)
    .pick(Object.fromEntries(config.writable.map((c) => [c, true])) as never);

  return {
    rowSchema,
    insertSchema,
    updateSchema,

    list: createServerFn({ method: 'GET' })
      .inputValidator(z.object({ subset: z.unknown().optional() }))
      .handler(async ({ data }) =>
        withStoreOperatorDb(async (db) => {
          await assertAllowed(config.operation);
          const s = toDrizzleSubset(config.table, allow, (data.subset ?? {}) as never);
          let q = db.select().from(config.table as never).$dynamic();
          if (s.where) q = q.where(s.where);
          if (s.orderBy) q = q.orderBy(...s.orderBy);
          if (s.limit !== undefined) q = q.limit(s.limit);
          if (s.offset !== undefined) q = q.offset(s.offset);
          return q;
        }),
      ),

    insert: createServerFn({ method: 'POST' })
      .inputValidator(insertSchema)
      .handler(async ({ data }) =>
        withStoreOperatorDb(async (db) => {
          await assertAllowed(config.operation);
          const [row] = await db.insert(config.table).values(data as never).returning();
          return row;
        }),
      ),

    update: createServerFn({ method: 'POST' })
      .inputValidator(z.object({ id: z.string().uuid(), patch: updateSchema }))
      .handler(async ({ data }) =>
        withStoreOperatorDb(async (db) => {
          await assertAllowed(config.operation);
          const [row] = await db
            .update(config.table)
            .set(data.patch as never)
            .where(eq((config.table as never)['id'], data.id))
            .returning();
          return row;
        }),
      ),

    remove: createServerFn({ method: 'POST' })
      .inputValidator(z.object({ id: z.string().uuid() }))
      .handler(async ({ data }) =>
        withStoreOperatorDb(async (db) => {
          await assertAllowed(config.operation);
          await db.delete(config.table).where(eq((config.table as never)['id'], data.id));
        }),
      ),
  };
}
```

🔴 **`assertAllowed` НЕ ІСНУЄ — його треба написати, і саме в
`simplycms/auth`.** Перевірено: там є `AUTHZ_MATRIX`, `resolveGrant`,
`can(subject, operation)`, `AuthzError` (`auth/authz.ts:57-98`) і
`readSessionSubject(headers)` (`auth/session.ts:48`), але склеєної
перевірки немає. Додати в `auth/authz-request.ts`:

```ts
// packages/simplycms/src/auth/authz-request.ts
import { getRequest } from '@tanstack/react-start/server';
import { AuthzError, can, type Operation } from './authz';
import { readSessionSubject } from './session';

/**
 * Перший рубіж моделі B5″: чи дозволена операція субʼєкту запиту.
 *
 * 🔴 Викликається ПЕРЕД доступом до БД. Роль БД (`SET LOCAL ROLE` у
 * `withActor`) — другий рубіж, страхувальна сітка проти забутого
 * `WHERE`, і вона першого не замінює: застосунок сам виставляє собі
 * claims.
 *
 * 🔴 Субʼєкт береться з СЕСІЇ, ніколи з параметра клієнта — id,
 * прийнятий від клієнта, RLS перевірити не може за побудовою.
 */
export async function assertAllowed(operation: Operation): Promise<void> {
  const subject = await readSessionSubject(getRequest().headers);
  if (!subject || !can(subject, operation)) {
    throw new AuthzError(operation);
  }
}
```

🔴 Живе в `simplycms/auth`, а не в `admin-server`: це звичайна функція, і
поруч із serverFn вона тягнула б серверний граф у клієнтський бандл
(Gate C). `auth` — bare-специфікатор, tsup вважає його зовнішнім.
Звірити конструктор `AuthzError` із чинним (`authz.ts:71`) і додати
експорт у барель `auth/index.ts`.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/resource.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add packages/simplycms/src/admin-server
git commit -m "feat(v2-k3): defineAdminResource — фабрика CRUD-serverFn

Типи й Zod виводяться з Drizzle (drizzle-zod), id обовʼязковий у
insertSchema (контракт Е0), права перевіряються ПЕРЕД доступом до БД.
DSL запитів свідомо немає — усе складніше йде в useLiveQuery або
іменовану операцію.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Ресурс `order_statuses` + іменована операція `setDefault`

**Files:**
- Create: `packages/simplycms/src/admin-server/resources/order-statuses.ts`
- Create: `packages/simplycms/src/admin-server/operations/order-status-default.ts`
- Test: `packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`

**Interfaces:**
- Produces: `orderStatusesResource` (CRUD) і `setDefaultOrderStatus({ id })`.

🔴 Перша сутність обрана саме через **доменний інваріант**: при
встановленні `is_default` прапорець знімається з решти
(`admin/pages/OrderStatuses.tsx:87-91`). Це і показує межу — фабрика
такого знати не може, тож операція пишеться руками й виконує обидві дії
**в одній транзакції**.

- [ ] **Step 1: Написати інтеграційний тест проти живої БД**

```ts
// packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts
// (шапка з resolveHarness/applySqlFiles — як у сусідніх тестах харнеса)

describe('order_statuses: інваріант єдиного дефолту', () => {
  it('setDefault знімає прапорець з решти В ОДНІЙ транзакції', async () => {
    const rows = await queryRows(dbUrl, 'select id, is_default from order_statuses order by sort_order');
    const target = rows.find((r) => !r.is_default)!;

    await setDefaultOrderStatus({ data: { id: target.id } });

    const after = await queryRows(dbUrl, 'select id, is_default from order_statuses');
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
    expect(after.find((r) => r.is_default)!.id).toBe(target.id);
  });

  it('неіснуючий id не лишає магазин без дефолту', async () => {
    // 🔴 Найнебезпечніший сценарій: зняли з усіх, а поставити нема кому.
    await expect(
      setDefaultOrderStatus({ data: { id: crypto.randomUUID() } }),
    ).rejects.toThrow();
    const after = await queryRows(dbUrl, 'select is_default from order_statuses');
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
Expected: FAIL — модулів немає.

- [ ] **Step 3: Ресурс**

```ts
// packages/simplycms/src/admin-server/resources/order-statuses.ts
import { orderStatuses } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

export const orderStatusesResource = defineAdminResource({
  entity: ENTITY.orderStatuses,
  table: orderStatuses,
  operation: 'catalog.write',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: ['name', 'code', 'color', 'sortOrder', 'isDefault'],
  readonly: ['id', 'createdAt'],
});
```

- [ ] **Step 4: Операція з інваріантом**

```ts
// packages/simplycms/src/admin-server/operations/order-status-default.ts
import { createServerFn } from '@tanstack/react-start';
import { eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { withStoreOperatorDb } from 'simplycms/storefront/loaders';
import { assertAllowed } from 'simplycms/auth';

/**
 * Призначити статус замовлення дефолтним.
 *
 * 🔴 Не лягає у фабрику: інваріант «дефолт рівно один» вимагає ЗНЯТИ
 * прапорець з решти, і обидві дії мусять бути в одній транзакції —
 * інакше між ними магазин лишається або без дефолту, або з двома.
 * Стара адмінка робила це двома окремими запитами з браузера
 * (`OrderStatuses.tsx:87-91`), тобто вікно неконсистентності було
 * реальним.
 *
 * Порядок навмисний: спершу ставимо новий (перевіряючи, що рядок
 * існує), потім знімаємо з інших. Зворотний порядок на неіснуючому id
 * лишив би магазин без дефолту взагалі.
 */
export const setDefaultOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    withStoreOperatorDb(async (db) => {
      await assertAllowed('catalog.write');

      const [row] = await db
        .update(orderStatuses)
        .set({ isDefault: true })
        .where(eq(orderStatuses.id, data.id))
        .returning();

      if (!row) {
        throw new Error(`[admin-server] статусу ${data.id} не існує`);
      }

      await db
        .update(orderStatuses)
        .set({ isDefault: false })
        .where(ne(orderStatuses.id, data.id));

      return row;
    }),
  );
```

- [ ] **Step 5: Запустити — має пройти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms
git commit -m "feat(v2-k3): ресурс order_statuses + операція setDefault

Перша сутність обрана через доменний інваріант: дефолт рівно один, і
зняття прапорця з решти мусить бути в тій самій транзакції. Стара
адмінка робила це двома запитами з браузера — вікно неконсистентності
було реальним. Порядок дій навмисний: неіснуючий id не лишає магазин
без дефолту.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
# Частина 3 — клієнтський шар

### Task 7: `admin-data` — реєстр колекцій

**Files:**
- Create: `packages/simplycms/src/admin-data/registry.ts`, `index.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/registry.test.tsx`
- Modify: `eslint.tier-zones.mjs` (зона T4), `tests/tier-boundary.test.ts`
- Modify: `packages/simplycms/package.json` (обидві мапи), `tsup.config.ts`

**Interfaces:**
- Produces: `useCollection(def)` — стабільний інстанс колекції на `QueryClient`.

🔴 Колекція memoізується по `QueryClient` і **не** створюється в рендері:
інстанс є джерелом підписки `useLiveQuery`, і нова інстанція скидає живий
стан. Це офіційно визнаний виняток із «не мемоізуй, React Compiler
зробить сам» (`skills/db-core/collection-setup/references/query-adapter.md`:
«Memoize by QueryClient… Do not create the collection during every render»).

- [ ] **Step 1: Написати падаючий тест**

```tsx
// packages/simplycms/src/admin-data/__tests__/registry.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollection } from '../registry';
import { orderStatusesCollection } from '../collections/order-statuses';

const wrapper = (client: QueryClient) =>
  function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe('реєстр колекцій', () => {
  it('той самий QueryClient — той самий інстанс', () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(() => useCollection(orderStatusesCollection), {
      wrapper: wrapper(client),
    });
    const first = result.current;
    rerender();
    // 🔴 Інакше useLiveQuery перепідписується й губить живий стан.
    expect(result.current).toBe(first);
  });

  it('різні QueryClient — різні інстанси', () => {
    const a = renderHook(() => useCollection(orderStatusesCollection), {
      wrapper: wrapper(new QueryClient()),
    });
    const b = renderHook(() => useCollection(orderStatusesCollection), {
      wrapper: wrapper(new QueryClient()),
    });
    // Кеш одного запиту не сміє протікати в інший.
    expect(a.result.current).not.toBe(b.result.current);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/admin-data/__tests__/registry.test.tsx`
Expected: FAIL — модулів немає.

- [ ] **Step 3: Написати реєстр**

```ts
// packages/simplycms/src/admin-data/registry.ts
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';

/**
 * Реєстр колекцій, ключований `QueryClient`.
 *
 * 🔴 `WeakMap`, а не module-level singleton: на сервері кожен запит має
 * власний `QueryClient` (Е1а поклав його в `getRouter()`), і спільний
 * інстанс колекції протік би між користувачами. `WeakMap` заразом
 * прибирає записи разом із клієнтом.
 *
 * 🔴 Інстанс мусить бути стабільним у межах клієнта: він є джерелом
 * підписки `useLiveQuery`, і нова інстанція скидає живий стан. Це
 * задокументований виняток із правила «не мемоізуй руками».
 */
type AnyCollection = ReturnType<typeof createCollection>;

export interface CollectionDef {
  readonly id: string;
  readonly create: (queryClient: QueryClient) => AnyCollection;
}

const byClient = new WeakMap<QueryClient, Map<string, AnyCollection>>();

export function getCollection(client: QueryClient, def: CollectionDef): AnyCollection {
  let byId = byClient.get(client);
  if (!byId) {
    byId = new Map();
    byClient.set(client, byId);
  }
  let collection = byId.get(def.id);
  if (!collection) {
    collection = def.create(client);
    byId.set(def.id, collection);
  }
  return collection;
}

/** Хук-обгортка: клієнт береться з контексту. */
export function useCollection(def: CollectionDef): AnyCollection {
  return getCollection(useQueryClient(), def);
}
```

- [ ] **Step 4: Тір-зона T4 + субшлях**

У `eslint.tier-zones.mjs`:
```js
// Колекції адмінки (Е1б) — T4: над `contracts`/`db`-контрактами, під
// сторінками. 🔴 Окремо від `src/admin` (T5) навмисно: колекція —
// module-level стан, і якби вона жила у файлі сторінки, дві сторінки на
// одну сутність дали б два інстанси й тихий розсинхрон.
['src/admin-data', 4, 'admin-data', []],
```
Обидві exports-мапи (`./admin-data`), явний патерн у tsup.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm build:packages && pnpm test:packaging
git add packages/simplycms eslint.tier-zones.mjs tests/tier-boundary.test.ts
git commit -m "feat(v2-k3): admin-data (T4) — реєстр колекцій по QueryClient

WeakMap, а не singleton: на сервері кожен запит має власний QueryClient
(Е1а), і спільна колекція протікала б між користувачами. Інстанс
стабільний у межах клієнта — він джерело підписки useLiveQuery.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Колекція `order_statuses`

**Files:**
- Create: `packages/simplycms/src/admin-data/collections/order-statuses.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts`

**Interfaces:**
- Consumes: `orderStatusesResource` (Task 6), `entityKey` (Е1а), `useCollection` (Task 7).
- Produces: `orderStatusesCollection: CollectionDef`.

- [ ] **Step 1: Написати падаючий тест id-mismatch**

```ts
// packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { getCollection } from '../registry';
import { orderStatusesCollection } from '../collections/order-statuses';

vi.mock('simplycms/admin-server', () => ({
  orderStatusesResource: {
    list: vi.fn(async () => []),
    // Сервер повертає ІНШИЙ ключ, ніж прислав клієнт.
    insert: vi.fn(async () => ({ id: 'server-generated', name: 'X' })),
    update: vi.fn(),
    remove: vi.fn(),
  },
  setDefaultOrderStatus: vi.fn(),
}));

describe('колекція order_statuses', () => {
  it('ключ колекції — з ENTITY, не літерал', async () => {
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    expect(c.id).toBe('order_statuses');
  });

  it('розходження ключів — fail-loud ДО write-back', async () => {
    // 🔴 Найважливіший тест етапу. Якби write-back стався, у synced-store
    // лягли б ДВА рядки: серверний під своїм ключем і оптимістичний під
    // клієнтським — без write-back, тобто зниклий на commit. Кожен
    // наступний update/delete бив би в неіснуючий ключ.
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    const optimisticId = crypto.randomUUID();

    const tx = c.insert({ id: optimisticId, name: 'X', code: 'x' } as never);
    await expect(tx.isPersisted.promise).rejects.toThrow(/id/);

    expect(c.has(optimisticId), 'оптимістичний рядок лишився').toBe(false);
    expect(c.has('server-generated'), 'серверний рядок-двійник потрапив').toBe(false);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 3: Написати колекцію**

```ts
// packages/simplycms/src/admin-data/collections/order-statuses.ts
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { orderStatusesResource } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';

const key = entityKey(ENTITY.orderStatuses);

/**
 * Довідник статусів — режим `eager` (рішення К3-5): обмежений розмір,
 * уся колекція в памʼяті, фільтрація живим запитом на клієнті.
 *
 * 🔴 `queryKey` — ТОЙ САМИЙ ключ, що в решти запитів цієї сутності:
 * query-collection знаходить свої записи префіксним матчем, і власний
 * ключ лишив би застарілі дані у спільному кеші.
 */
export const orderStatusesCollection: CollectionDef = {
  id: ENTITY.orderStatuses,
  create: (queryClient) =>
    createCollection(
      queryCollectionOptions({
        id: ENTITY.orderStatuses,
        queryClient,
        queryKey: key.list(),
        getKey: (row: { id: string }) => row.id,
        schema: orderStatusesResource.rowSchema,
        queryFn: async () => orderStatusesResource.list({ data: {} }),

        onInsert: async ({ transaction, collection }) => {
          const { modified } = transaction.mutations[0];
          const row = await orderStatusesResource.insert({ data: modified as never });

          // 🔴 Fail-loud ДО write-back: інакше в synced-store лягли б два
          // рядки — серверний під своїм ключем і оптимістичний під
          // клієнтським, який зникне на commit (урок favorites MetaHub).
          if (row.id !== modified.id) {
            throw new Error(
              `[admin-data] сервер повернув id "${row.id}", а оптимістичний ` +
                `рядок має "${modified.id}" — write-back писав би не в той ключ`,
            );
          }

          // 🔴 writeUpsert, НІКОЛИ writeUpdate: рядка ще немає в
          // syncedData, і writeUpdate кинув би UpdateOperationItemNotFound.
          collection.utils.writeUpsert(row);
          return { refetch: false };
        },

        onUpdate: async ({ transaction, collection }) => {
          const { key: id, changes } = transaction.mutations[0];
          const row = await orderStatusesResource.update({
            data: { id: id as string, patch: changes as never },
          });
          collection.utils.writeUpsert(row);
          return { refetch: false };
        },

        onDelete: async ({ transaction, collection }) => {
          const { key: id } = transaction.mutations[0];
          await orderStatusesResource.remove({ data: { id: id as string } });
          collection.utils.writeDelete([id]);
          return { refetch: false };
        },
      }),
    ),
};
```

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Коміт**

```bash
git add packages/simplycms/src/admin-data
git commit -m "feat(v2-k3): колекція order_statuses з write-back і fail-loud

Ключ — той самий entityKey, що в решти запитів сутності (префіксний
матч query-collection). Happy-path синхронізується writeUpsert, не
інвалідацією власного ключа. Розходження ключів кидає ДО write-back,
інакше в колекції лишився б рядок-двійник (урок favorites MetaHub).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Сторінка на `useLiveQuery`

**Files:**
- Modify: `packages/simplycms/src/admin/pages/OrderStatuses.tsx`
- Modify: `packages/simplycms/routes/admin/admin/order-statuses/index.tsx` (preload у `loader`)

**Interfaces:**
- Consumes: `useCollection`, `orderStatusesCollection`, `setDefaultOrderStatus`.

🔴 `preload()` ставиться в `loader` роуту, а не в компоненті — інакше
перший рендер піде з порожньою колекцією. Для `eager`-колекції це
звичайний `collection.preload()`; для on-demand (Е3) — preload
`createLiveQueryCollection`, бо на джерелі він **no-op**.

- [ ] **Step 1: Переписати сторінку**

```tsx
// ключові фрагменти OrderStatuses.tsx
const collection = useCollection(orderStatusesCollection);

const { data: statuses } = useLiveQuery((q) =>
  q.from({ s: collection }).orderBy(({ s }) => s.sortOrder, 'asc'),
);

const handleCreate = (form: FormValues) => {
  // 🔴 Ключ генерує клієнт: інакше оптимістичний рядок і серверний
  // розійдуться (контракт Е0).
  collection.insert({ id: crypto.randomUUID(), ...form });
};

const handleDelete = (id: string) => collection.delete(id);

const handleSetDefault = async (id: string) => {
  // Інваріант «дефолт рівно один» — серверна операція; після неї
  // рефетч, бо змінилось БІЛЬШЕ рядків, ніж один оптимістичний.
  await setDefaultOrderStatus({ data: { id } });
  await collection.utils.refetch();
};
```

🔴 `handleSetDefault` — єдине місце, де рефетч правильний: операція
міняє N рядків, і write-back одного тут не описує стан. Це не виняток із
канону, а його межа.

- [ ] **Step 2: Preload у роуті**

```tsx
// packages/simplycms/routes/admin/admin/order-statuses/index.tsx
export const Route = createFileRoute('/admin/order-statuses/')({
  loader: async ({ context }) => {
    await getCollection(context.queryClient, orderStatusesCollection).preload();
    return null;
  },
  component: OrderStatuses,
});
```

- [ ] **Step 3: Гейти**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```
Expected: PASS, 0 errors. 🔴 Лінт тут ще й доводить, що i18n-рядки не
загубились при переписуванні.

- [ ] **Step 4: ЖИВИЙ прогін — головний доказ етапу**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
# створити адміна: див. v2-state-map.md §5 (issueOwnerInvite)
pnpm build && PORT=3141 pnpm start &
```

У браузері під адміном на `/admin/order-statuses`:
1. Список рендериться з БД;
2. **створення** — рядок зʼявляється **миттєво**, до відповіді сервера;
3. **видалення** — зникає миттєво;
4. **призначення дефолту** — прапорець переїжджає, у решти знімається;
5. консоль: нуль `console.error`;
6. **rollback**: тимчасово зупинити сервер і спробувати створити —
   рядок має **зникнути** сам, без перезавантаження.

🔴 П. 6 — доказ того, заради чого весь етап: авто-rollback від колекції.
Без нього оптимізм лишається обіцянкою.

- [ ] **Step 5: Коміт**

```bash
git add packages/simplycms
git commit -m "feat(v2-k3): OrderStatuses на useLiveQuery — перша жива сторінка

Читання — живий запит із колекції, запис — collection.insert/delete з
оптимізмом і авто-rollback. setDefault лишається серверною операцією з
рефетчем: вона міняє N рядків, і write-back одного не описує стан.
preload у loader роуту — інакше перший рендер із порожньою колекцією.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Гейти мутацій — `mutation-cache-sync` і `handler-canon`

**Files:**
- Create: `eslint-rules/mutation-cache-sync.mjs`
- Create: `tests/handler-canon.test.ts`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: два незалежні гейти на різні поверхні одного інваріанту.

🔴 Два, а не один: `mutation-cache-sync` дивиться на **React-хуки**
(`useMutation` у файлі сторінки), `handler-canon` — на **persistence-
хендлери колекції**. Мутація може бути коректною на одному рівні й
зламаною на іншому; у MetaHub це два незалежні артефакти саме тому.

- [ ] **Step 1: `handler-canon` — AST-гейт write-back**

```ts
// tests/handler-canon.test.ts
/**
 * Кожен `return { refetch: false }` у persistence-хендлері
 * (`onInsert`/`onUpdate`/`onDelete`) мусить мати write-back
 * (`writeUpsert`/`writeUpdate`/`writeInsert`/`writeDelete`/`writeBatch`)
 * у СВОЇЙ домінуючій гілці.
 *
 * 🔴 Path-sensitive, а не текстовий скан: `if (x) { return {refetch:false} }`
 * без write-back у тій самій гілці — саме той дефект, який шукаємо.
 * Виняток — коментар `// canon-exempt: <причина>` рядком вище.
 *
 * BASELINE порожній і лишається порожнім: гейт постійний, не міграційний.
 */
```

Реалізація — обхід через TypeScript compiler API: для кожного
`ReturnStatement`, чий вираз має `refetch: false`, піднятись по
батьківських блоках і перевірити наявність виклику `write*` серед
попередніх statements.

- [ ] **Step 2: Негативний контроль `handler-canon`**

```bash
# У колекції тимчасово: прибрати рядок collection.utils.writeUpsert(row)
# у onInsert, лишивши return { refetch: false }.
pnpm vitest run tests/handler-canon.test.ts
# Expected: FAIL із назвою файлу й рядком
# Повернути → PASS
```

- [ ] **Step 3: `mutation-cache-sync` — правило на хуки**

```js
// eslint-rules/mutation-cache-sync.mjs
/**
 * Клієнтська мутація мусить лишати слід у кеші.
 *
 * Шар 1: файл із `useMutation` мусить мати хоч якийсь сигнал —
 *   invalidateQueries / setQueryData / removeQueries / refetchQueries
 *   або collection.utils.{refetch,writeUpsert,writeUpdate,writeDelete}.
 * Шар 2: якщо є `invalidateQueries` — мусить бути й collection-синк,
 *   інакше список TanStack DB не оновиться без reload.
 *
 * 🔴 Правило евристичне за побудовою (будь-який синк у файлі рахується):
 * можливі фолс-негативи, але не фолс-позитиви. Строгість дає
 * `handler-canon` через dataflow-аналіз. Opt-out —
 * `// cache-sync-ok: <причина>`.
 */
```

- [ ] **Step 4: Контролі правила**

```bash
# НЕГАТИВНИЙ: додати у файл сторінки useMutation без жодного синку
pnpm lint   # Expected: FAIL
# ПОЗИТИВНИЙ: додати поруч collection.utils.refetch()
pnpm lint   # Expected: 0 errors
# Прибрати → 0 errors / 12 warnings
```

- [ ] **Step 5: Повний ланцюг і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
  && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
  && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
pnpm pilot:pack
git add eslint-rules tests eslint.config.mjs
git commit -m "test(v2-k3): гейти мутацій — cache-sync і handler-canon

Дві різні поверхні одного інваріанту: правило дивиться на React-хуки,
AST-гейт — на persistence-хендлери колекції. Мутація може бути
коректною на одному рівні й зламаною на іншому.

BASELINE handler-canon порожній і лишається порожнім.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## DoD етапу Е1б

1. **Повний ланцюг гейтів зелений** (десять кроків) + `pnpm pilot:pack`;
   `pnpm lint` = 0 errors, 12 warnings.

2. **Контролі прогнані вручну — усі шість:**
   - Task 1 — прибрана залежність агрегату червонить гейт `deps`;
   - Task 8 — розходження ключів кидає й не лишає жодного рядка;
   - Task 10 — `handler-canon` без write-back падає; `mutation-cache-sync`
     негативний і позитивний;
   - Task 4 / Task 7 — імпорт угору по тіру валить лінт (обидві зони).

3. **Жива сторінка** `/admin/order-statuses` під адміном: список, миттєве
   створення й видалення, переїзд дефолту, **авто-rollback при
   зупиненому сервері**, нуль `console.error`.

4. **`test:schema`** доводить інваріант дефолту в одній транзакції.

5. **Gate C пілота** зелений — `simplycms/admin-server` не поїхав у
   клієнтський бандл разом із drizzle і пулом.

6. **`ENTITY`, ключі й `deps`** узгоджені: гейт повноти зелений на всіх
   восьми агрегатах.

## Що НЕ входить в Е1б

- Решта 52 файлів `src/admin/**` — хвилі Е3–Е6.
- `syncMode: 'on-demand'` і push-down — Е3 (каталог); тут лише `eager`.
- Storage-порт і `ImageUpload` — Е2.
- Прибирання виїмки `admin/` з правила ключів — після переписування всіх
  сторінок (закриє DoD К3-3).
- Борги Е1а №4 (`detail()` змішує slug і uuid), №6 (`scoped` у двох
  значеннях), №8 (зона правила не дістає до тем і плагінів) — вони
  проявляться на каталозі, тобто в Е3.

## Точка передачі

Після закриття DoD — повернутись на валідацію з чотирма артефактами:
вивід повного ланцюга, вивід **усіх шести** контролів, запис або опис
живого прогону (особливо п. 3 з rollback), і `git log --oneline` етапу.

Наступний план — **Е2: Storage-мінімум** (`MediaProvider` + драйвер
`local-fs`), після нього **Е3: каталог на on-demand** — там уперше
працює push-down, і туди ж переїжджають три борги Е1а, що стосуються
каталогу.
