# V2-К3 · Етап Е0: контракт id (клієнтська генерація ключів)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести проєкт на клієнтську генерацію первинних ключів і зняти `DEFAULT gen_random_uuid()` з таблиць, які створює клієнт — без цього оптимістичні мутації TanStack DB структурно неможливі.

**Architecture:** Порядок жорсткий — **код перед DDL**. Спершу кожен серверний insert-шлях починає передавати `id` явно (Task 1), сіди отримують статичні UUID (Task 2), контракт плагінів вимагає `id` (Task 3), і лише тоді знімається DEFAULT у baseline під машинним гейтом (Task 4). Зворотний порядок поклав би вітрину, яка сьогодні працює.

**Tech Stack:** PostgreSQL 17 · Drizzle 0.45.2 · TypeScript 5.9 strict · Vitest 4 · pg-харнес `packages/simplycms/test-harness/pg`

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — рішення К3-6, К3-11; Додаток А-1, А-2; Додаток Б-3

**Обсяг:** етап Е0 зі спеки §«Фазування». Це перший із серії планів треку К3. Наступні (Е1 — інфраструктура серверного шару й перша сутність; Е2 — Storage-мінімум; Е3 — каталог on-demand; Е4–Е6 — хвилі сутностей; Е7–Е8 — знос легасі й живий прогін) пишуться **після валідації попереднього**: їхні деталі залежать від того, як ляже цей етап.

**Чому Е0 окремо і першим.** Він не залежить від TanStack DB взагалі й перевіряється наскрізь наявними гейтами. Після нього магазин працює на новому контракті id, а трек отримує інваріант, на який спираються всі подальші етапи: ключ рядка завжди відомий клієнту до відповіді сервера.

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7 (peer `typescript-eslint`, `tsup --dts`).
- Коментарі й документація — **українською**; рядки інтерфейсу — тільки через i18n-каталоги.
- `pnpm lint` = **0 errors**; ворнінги не додавати.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`.
- `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки `package.json`.
- 🔴 Міграції **не** застосовуються через Supabase MCP. Накат канону на чисту БД — `pnpm db:demo` або харнес `pnpm test:schema`; накат робить **власник БД**, не роль `app_runtime`.
- **Категорія A** (`DROP DEFAULT`, `id` від клієнта): усе, що створює клієнт або серверний код магазину.
- **Категорія B** (DEFAULT лишається конструктивно): `users`, `sessions`, `accounts`, `verifications` — Better Auth не кладе `id` в INSERT (`auth/instance.ts:78-87`); `orders` — сервер генерує разом з атомарним `order_number`.
- Кожен новий гейт має **негативний контроль** — навмисно зламаний варіант, на якому гейт червоніє (урок К1а-9 і 0.4.1-5: структурна перевірка не є доказом поведінки).
- Breaking change дозволений і бажаний: клієнтів і магазинів немає, перехідних шимів не робимо.
- Коміти українською, `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts` | Гейт: серверні вставки Категорії A несуть явний `id` |
| `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts` | Гейт: сід детермінований, UUID статичні й унікальні |
| `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts` | Гейт: `DEFAULT` лише в Категорії B (з негативним контролем) |
| `packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts` | Гейт: порт плагіна кидає без `id` |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/src/storefront/loaders/{order-create,reviews-write,addresses,recipients}.ts` | явний `id` у `.values()` |
| `packages/simplycms/src/auth/provision.ts` | явний `id` для `profiles`, `userRoles` |
| `packages/simplycms/migrations/0003_seed.sql` | статичні UUID (6 INSERT) |
| `packages/simplycms/migrations/demo/demo-seed.sql` | статичні UUID (15 INSERT) |
| `packages/simplycms/migrations/0001_init.sql` | `DROP DEFAULT` на Категорії A + `COMMENT ON COLUMN` |
| `packages/simplycms/migrations/0002_grants.sql:186-189` | стале пояснення про сиквенси |
| `packages/simplycms/src/schema/schema.ts` | зняти `.defaultRandom()` у Категорії A |
| `packages/simplycms/src/plugin-sdk/{usePluginTable.ts,server/table-db.ts}` | `id` обов'язковий |
| `packages/simplycms-plugin-faq/**` | генерація id у UI, DDL без DEFAULT |
| `packages/cli/src/create-scaffold.mjs` | шаблон міграції плагіна без DEFAULT |

**Свідомо НЕ чіпаються:** `packages/simplycms/src/admin/**` — 27 клієнтських вставок старої адмінки. Вона не працює на чистому Postgres і повністю переписується в Е1+; лагодити її вставки означало б робити роботу двічі.

---

# Етап Е0 — контракт id

Порядок жорсткий: **код перед DDL**. Спершу кожен insert-шлях починає передавати `id`, і лише в Task 4 знімається DEFAULT. Зворотний порядок поклав би вітрину.

### Task 1: Серверні вставки вітрини передають id явно

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/order-create.ts:87-131`
- Modify: `packages/simplycms/src/storefront/loaders/reviews-write.ts:27`
- Modify: `packages/simplycms/src/storefront/loaders/addresses.ts:66`
- Modify: `packages/simplycms/src/storefront/loaders/recipients.ts:81`
- Modify: `packages/simplycms/src/auth/provision.ts:16,29`
- Test: `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`

**Interfaces:**
- Consumes: `withActor`/`withCustomerDb` з `simplycms/storefront/loaders` (наявні).
- Produces: нічого нового — змінюється лише payload наявних вставок.

🔴 `invite-store.ts:29` вставляє в `users` — це **Категорія B**, там `id` НЕ додається (Better Auth делегує генерацію базі). Рядок `verifications:46` — теж B. А от `userRoles:70` і `profiles` — Категорія A.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../../src');

/**
 * Гейт Е0: кожна серверна вставка в таблицю Категорії A несе явний `id`.
 * Текстовий скан, а не рантайм: рантайм довів би лише пройдені шляхи.
 */
const CATEGORY_A_INSERTS = [
  ['storefront/loaders/order-create.ts', 'orders'],
  ['storefront/loaders/order-create.ts', 'orderItems'],
  ['storefront/loaders/reviews-write.ts', 'productReviews'],
  ['storefront/loaders/addresses.ts', 'userAddresses'],
  ['storefront/loaders/recipients.ts', 'userRecipients'],
  ['auth/provision.ts', 'profiles'],
  ['auth/provision.ts', 'userRoles'],
] as const;

describe('Е0: серверні вставки передають id явно', () => {
  it.each(CATEGORY_A_INSERTS)('%s → %s', (file, table) => {
    const src = readFileSync(resolve(SRC, file), 'utf8');
    const idx = src.indexOf(`.insert(${table})`);
    expect(idx, `не знайдено .insert(${table}) у ${file}`).toBeGreaterThan(-1);
    const window = src.slice(idx, idx + 600);
    expect(window, `.insert(${table}) у ${file} не передає id`).toMatch(
      /\bid:\s*(randomUUID\(\)|[A-Za-z_$][\w$]*Id\b|[A-Za-z_$][\w$]*\.id\b)/,
    );
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: FAIL, сім кейсів — «не передає id».

- [ ] **Step 3: Додати id у кожну вставку**

```ts
// order-create.ts — id батька відомий ДО вставки, тож позиції більше
// не чекають RETURNING: обидві вставки лягають без зайвого раундтрипу.
import { randomUUID } from 'node:crypto';

const orderId = randomUUID();

await db.insert(orders).values({
  id: orderId,
  userId,
  accessToken,
  orderNumber,
  statusId: await loadDefaultStatusId(db),
  // …решта полів без змін
});

await db.insert(orderItems).values(
  input.items.map((item) => ({
    id: randomUUID(),
    orderId,
    // …решта полів без змін
  })),
);
```

🔴 `orders` — Категорія B (DEFAULT лишається), але явний `id` тут усе одно
правильний: він прибирає двокроковий `RETURNING`-ланцюг. DEFAULT
залишається як страхувальна сітка для самої БД, а не як спосіб вставки.

Так само в решті чотирьох файлів: `id: randomUUID()` першим полем
`.values({ … })`. Імпорт `randomUUID` з `node:crypto` — це серверні
модулі, `crypto.randomUUID()` браузерного API тут не потрібен.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Перевірити, що вітрина не зламалась**

Run: `pnpm test`
Expected: PASS. Далі — живий доказ, бо тест схеми цього шляху не виконує:

```bash
PG_HARNESS_URL=postgresql://$USER@127.0.0.1:5432/postgres pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s localhost:3141/api/health
```
Expected: `{"status":"healthy",...}`.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms/src packages/simplycms/test-harness
git commit -m "feat(v2-k3): серверні вставки вітрини передають id явно

Передумова зняття DEFAULT (Е0): клієнтський ключ мусить бути єдиним
джерелом id. Заразом прибрано двокроковий RETURNING у order-create —
id замовлення тепер відомий до вставки, тож позиції не чекають на нього.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Сіди отримують статичні UUID

**Files:**
- Modify: `packages/simplycms/migrations/0003_seed.sql`
- Modify: `packages/simplycms/migrations/demo/demo-seed.sql`
- Test: `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`

**Interfaces:**
- Produces: стабільні UUID сіду — на них спиратиметься e2e (борг №4 роадмапу: сім динамічних роутів адмінки, що потребують реальних id).

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

/**
 * Сід мусить бути детермінованим: без явних id ті самі дані щоразу
 * отримують нові ключі, і e2e не може адресувати рядок (борг №4).
 */
describe('Е0: сід детермінований', () => {
  it('0003_seed.sql не покладається на DEFAULT для id', () => {
    const sql = readFileSync(resolve(MIGRATIONS, '0003_seed.sql'), 'utf8');
    const inserts = sql.match(/insert into[\s\S]*?;/gi) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const stmt of inserts) {
      expect(stmt, `INSERT без явного id:\n${stmt.slice(0, 200)}`).toMatch(
        /\(\s*id\b|\bid\s*,/i,
      );
    }
  });

  it('усі id сіду — валідні UUID-літерали', () => {
    const sql = readFileSync(resolve(MIGRATIONS, '0003_seed.sql'), 'utf8');
    const uuids = sql.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi) ?? [];
    expect(uuids.length).toBeGreaterThan(0);
    expect(new Set(uuids).size, 'дубльовані UUID у сіді').toBe(uuids.length);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: FAIL — «INSERT без явного id».

- [ ] **Step 3: Проставити статичні UUID**

Схема нумерації, щоб ключі читались очима: префікс `0000000N` за
таблицею, суфікс — порядковий номер рядка.

```sql
-- 0003_seed.sql
insert into public.order_statuses (id, name, code, color, sort_order, is_default)
values
  ('00000001-0000-4000-8000-000000000001', 'Новий',        'new',       '#3B82F6', 0, true),
  ('00000001-0000-4000-8000-000000000002', 'В обробці',    'processing','#F59E0B', 1, false),
  ('00000001-0000-4000-8000-000000000003', 'Відправлено',  'shipped',   '#8B5CF6', 2, false),
  ('00000001-0000-4000-8000-000000000004', 'Виконано',     'completed', '#10B981', 3, false),
  ('00000001-0000-4000-8000-000000000005', 'Скасовано',    'cancelled', '#EF4444', 4, false)
on conflict (code) do nothing;

insert into public.languages (id, code, name, is_default, is_active)
values ('00000002-0000-4000-8000-000000000001', 'uk', 'Українська', true, true)
on conflict (code) do nothing;

insert into public.price_types (id, name, code, is_default, sort_order)
values ('00000003-0000-4000-8000-000000000001', 'Роздрібна', 'retail', true, 0)
on conflict (code) do nothing;
```

🔴 `on conflict` лишається за **натуральним** ключем (`code`), не за `id` —
семантика «сід ідемпотентний» не змінюється.

Решту INSERT-ів у `0003_seed.sql` (`user_categories`, `system_settings`,
`themes`) і всі 15 у `demo/demo-seed.sql` — за тією ж схемою. У демо-сіді
дочірні рядки, що сьогодні беруть батька через `select s.id`, тепер
посилаються на константу напряму.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Довести накатом на чисту БД**

Run: `pnpm test:schema`
Expected: PASS. Потім двічі поспіль — сід ідемпотентний:

```bash
PG_HARNESS_URL=postgresql://$USER@127.0.0.1:5432/postgres pnpm db:demo
PG_HARNESS_URL=postgresql://$USER@127.0.0.1:5432/postgres pnpm db:demo
```
Expected: другий прогін без помилок, кількість рядків не подвоїлась.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms/migrations packages/simplycms/test-harness
git commit -m "feat(v2-k3): детермінований сід — статичні UUID замість DEFAULT

Передумова зняття DEFAULT (Е0) і заразом закриття боргу №4 роадмапу:
сім динамічних роутів адмінки поза e2e потребували реальних id із сіду.
on conflict лишається за натуральним ключем — ідемпотентність не змінилась.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Контракт плагінів вимагає id

**Files:**
- Modify: `packages/simplycms/src/plugin-sdk/usePluginTable.ts:33-42,60-75`
- Modify: `packages/simplycms/src/plugin-sdk/server/table-db.ts:70-90`
- Modify: `packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql:15`
- Modify: `packages/simplycms-plugin-faq/src/pages/FaqAdmin.tsx:43-49`
- Modify: `packages/cli/src/create-scaffold.mjs` (шаблон міграції плагіна)
- Test: `packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts`

**Interfaces:**
- Consumes: `PluginTablePort<Row>` (наявний).
- Produces: `PluginTablePort.insert(row)` тепер вимагає `row.id: string`; `insertPluginRow` кидає без нього.

🔴 Робиться зараз, бо вікно закривається на К5: після відкриття подач
маркетплейсу контракт заморожується першим стороннім пакетом.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts
import { describe, expect, it, vi } from 'vitest';
import { insertPluginRow } from '../server/table-db';

vi.mock('simplycms/storefront/loaders', () => ({
  withStorefrontDb: vi.fn(),
  withStoreOperatorDb: vi.fn(),
}));

describe('порт плагіна: id обов’язковий', () => {
  it('insertPluginRow без id кидає з поясненням', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q', answer: 'a' }),
    ).rejects.toThrow(/id/i);
  });

  it('повідомлення називає плагін і таблицю', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q' }),
    ).rejects.toThrow(/plg_faq_items/);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts`
Expected: FAIL — вставка не кидає (сьогодні `id` необов'язковий).

- [ ] **Step 3: Зробити id обов'язковим**

```ts
// server/table-db.ts, на початку insertPluginRow — ПЕРЕД guardedTable,
// щоб помилка контракту не маскувалась помилкою доступу
export async function insertPluginRow(
  pluginName: string,
  table: string,
  row: Record<string, PluginCell>,
): Promise<PluginRow> {
  if (typeof row.id !== 'string' || row.id.length === 0) {
    throw new Error(
      `[plugin-sdk] insert у ${table} (плагін ${pluginName}) без id. ` +
        'Ключ генерує КЛІЄНТ (crypto.randomUUID()) — інакше оптимістичний ' +
        'рядок і серверний розійдуться ключами. DEFAULT у plg_*-таблицях ' +
        'знято навмисно.',
    );
  }
  const name = await guardedTable(pluginName, table);
  // …решта без змін
}
```

```ts
// usePluginTable.ts — тип входу звужується
export interface PluginTablePort<Row extends Record<string, unknown>> {
  list(options?: { orderBy?: string; ascending?: boolean; eq?: Partial<Row> }): Promise<Row[]>;
  /** 🔴 `id` генерує викликач: ключ мусить бути відомий до відповіді сервера. */
  insert(row: Partial<Row> & { id: string }): Promise<Row>;
  update(id: string, patch: Partial<Row>): Promise<Row>;
  remove(id: string): Promise<void>;
}
```

```sql
-- packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql
  id uuid primary key,   -- 🔴 без default: ключ приходить від клієнта
```

```tsx
// FaqAdmin.tsx
await table.insert({
  id: crypto.randomUUID(),
  question,
  answer,
  product_id: productId,
  sort_order: sortOrder,
  is_active: true,
});
```

Той самий рядок `id uuid primary key,` — у шаблоні міграції, який
генерує `simplycms create plugin` (`packages/cli/src/create-scaffold.mjs`).

🔴 **`crypto.randomUUID()` доступний лише в secure context** (`https://`
або `localhost`); на `http://192.168.x.x:3000` він `undefined`. У Е0 це ще
не проявляється — `FaqAdmin` живе в адмінці, яка на чистому Postgres не
працює. Fail-loud перевірка secure context при старті адмінки
приземляється в **Е1** разом з рештою адмін-точок; тут фіксується лише
контракт. Пакет `uuid` не додається: це була б обгортка заради обгортки,
а адмінці HTTPS потрібен і без UUID — Better Auth ставить `Secure`-cookie.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Перевірити наскрізний контур плагінів**

Run: `pnpm test && pnpm lint`
Expected: PASS, 0 errors.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms/src/plugin-sdk packages/simplycms-plugin-faq packages/cli/src
git commit -m "feat(v2-k3)!: порт плагінів вимагає клієнтський id

BREAKING CHANGE: PluginTablePort.insert тепер вимагає row.id, а plg_*
таблиці створюються без DEFAULT. Робиться зараз, бо вікно закривається
на К5 — після відкриття подач маркетплейсу контракт заморожує перший
сторонній пакет. Сторонніх плагінів сьогодні нуль, ціна зміни нульова.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: DROP DEFAULT у baseline + гейт у test:schema

**Files:**
- Modify: `packages/simplycms/migrations/0001_init.sql` (id-колонки Категорії A)
- Modify: `packages/simplycms/migrations/0002_grants.sql:186-189` (стале пояснення)
- Modify: `packages/simplycms/src/schema/schema.ts` (зняти `.defaultRandom()` у Категорії A)
- Test: `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts`

**Interfaces:**
- Consumes: харнес `test-harness/pg` (наявний: `apply.mjs`, `up.mjs`).
- Produces: інваріант «Категорія A без DEFAULT», на який спирається fail-loud guard Task 13.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const canonFiles = (): string[] =>
  readdirSync(CANON_DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((n) => join(CANON_DIR, n));

/**
 * Категорія B — DEFAULT лишається КОНСТРУКТИВНО:
 *  • таблиці Better Auth: `generateId:'uuid'` + `supportsUUIDs` драйвера
 *    означає, що BA не кладе id в INSERT узагалі (`auth/instance.ts:78-87`);
 *  • `orders`: створює сервер із атомарним `order_number`, клієнт цим id
 *    не оперує.
 * Усе інше — Категорія A, і DEFAULT там є регресією.
 */
const CATEGORY_B = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'orders',
]);

const ID_DEFAULTS_SQL = `
  select c.relname as table_name,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '') ilike '%gen_random_uuid%'
           as has_default
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind = 'r'
     and a.attname = 'id' and a.attnum > 0 and not a.attisdropped
`;

describe('Е0: DEFAULT на id лише в Категорії B', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_id_defaults');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('жодна таблиця Категорії A не має DEFAULT на id', async () => {
    const rows = await queryRows(dbUrl, ID_DEFAULTS_SQL);
    expect(rows.length).toBeGreaterThan(0);
    const offenders = rows
      .filter((r) => r.has_default && !CATEGORY_B.has(r.table_name))
      .map((r) => r.table_name)
      .sort();
    expect(
      offenders,
      `DEFAULT на id у Категорії A: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('Категорія B DEFAULT зберігає — інакше ляже auth і створення замовлень', async () => {
    const rows = await queryRows(dbUrl, ID_DEFAULTS_SQL);
    const withDefault = new Set(
      rows.filter((r) => r.has_default).map((r) => r.table_name),
    );
    for (const table of CATEGORY_B) {
      expect(
        withDefault.has(table),
        `${table} втратила DEFAULT — Категорія B`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm test:schema`
Expected: FAIL — перший кейс перелічує ~40 таблиць Категорії A.

- [ ] **Step 3: Зняти DEFAULT у baseline і схемі**

У `0001_init.sql` для кожної таблиці Категорії A:

```sql
	"id" uuid PRIMARY KEY NOT NULL,
```

(було: `"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL`).
Для п'яти таблиць Категорії B рядок лишається без змін.

Наприкінці файлу — коментарі-інваріанти, щоб наступний читач схеми бачив
контракт, а не забутий DEFAULT:

```sql
COMMENT ON COLUMN "products"."id" IS 'Категорія A: client-generated UUID. DEFAULT знято навмисно — fail-loud guard проти розсинхрону оптимістичного й серверного ключа.';
COMMENT ON COLUMN "orders"."id" IS 'Категорія B: id генерує сервер разом із атомарним order_number. DEFAULT свідомо збережено.';
```

У `schema.ts` — прибрати `.defaultRandom()` у Категорії A:

```ts
export const orderStatuses = pgTable("order_statuses", {
	id: uuid().primaryKey().notNull(),
	// …решта без змін
});
```

У `0002_grants.sql:186-189` оновити пояснення: сиквенсів немає не тому,
що «всі PK — uuid з `gen_random_uuid()`», а тому, що тип PK лишається
`uuid` — гранти на сиквенси не потрібні в обох випадках.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm test:schema`
Expected: PASS, обидва кейси.

- [ ] **Step 5: Негативний контроль**

Тимчасово повернути DEFAULT одній таблиці Категорії A і переконатись, що
гейт червоніє — інакше він нічого не доводить:

```bash
# 1. Вручну повернути DEFAULT рівно ОДНІЙ таблиці Категорії A: у
#    0001_init.sql знайти CREATE TABLE "banners" і замінити рядок
#      "id" uuid PRIMARY KEY NOT NULL,
#    на
#      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
# 2. Прогнати гейт — він МУСИТЬ почервоніти:
pnpm test:schema
# Expected: FAIL — 'DEFAULT на id у Категорії A: banners'
# 3. Відкотити контрольну правку:
git checkout packages/simplycms/migrations/0001_init.sql
```

🔴 Якщо гейт лишився зеленим — він нічого не доводить, і етап не можна
закривати. Це той самий клас сліпоти, що дав борги К1а-9 і 0.4.1-5.

- [ ] **Step 6: Довести повний накат і живий магазин**

```bash
pnpm build && pnpm test && pnpm test:schema
PG_HARNESS_URL=postgresql://$USER@127.0.0.1:5432/postgres pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s -o /dev/null -w '%{http_code}\n' localhost:3141/ localhost:3141/catalog
```
Expected: гейти PASS; обидві сторінки `200`.

- [ ] **Step 7: Коміт**

```bash
git add packages/simplycms/migrations packages/simplycms/src/schema packages/simplycms/test-harness
git commit -m "feat(v2-k3)!: DROP DEFAULT на id Категорії A + гейт у test:schema

BREAKING CHANGE: baseline більше не генерує id для таблиць, які створює
клієнт. Забутий id тепер падає 23502 у момент помилки, а не мовчки
розходиться ключем з оптимістичним рядком. Категорія B (Better Auth,
orders) DEFAULT зберігає конструктивно — див. COMMENT ON COLUMN.

Гейт має негативний контроль: повернений DEFAULT червонить test:schema.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## DoD етапу Е0

Етап закритий, коли **всі** пункти виконані й перевірені:

1. **Гейти зелені у повному ланцюзі:**
   ```bash
   pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
     && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
     && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
   ```
   Очікується: усе PASS, `pnpm lint` = 0 errors.

2. **Негативний контроль гейта DEFAULT відпрацював** (Task 4, Step 5):
   повернений DEFAULT одній таблиці Категорії A червонить `pnpm test:schema`
   з іменем цієї таблиці у повідомленні. Без цього кроку гейт не доведений.

3. **Живий прогін, а не тести** (канон репо — доводить прогін, не зелений CI):
   ```bash
   PG_HARNESS_URL=postgresql://$USER@127.0.0.1:5432/postgres pnpm db:demo
   pnpm build && PORT=3141 pnpm start &
   curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/catalog \
     localhost:3141/cart localhost:3141/api/health; echo
   ```
   Очікується: `200 200 200 200`.

4. **Наскрізний контур покупки прожитий вручну** — саме він містить
   найбільше нових `id`: додати товар у кошик → оформити замовлення →
   переконатись, що замовлення й позиції створились (прямим SQL, бо
   HTTP-API до БД у контракті v2 немає):
   ```sql
   select o.order_number, count(i.id) as items
   from orders o join order_items i on i.order_id = o.id
   group by o.order_number order by o.created_at desc limit 1;
   ```
   Очікується: рядок із ненульовою кількістю позицій.

5. **Сід ідемпотентний** — `pnpm db:demo` двічі поспіль не подвоює рядки.

6. **`pnpm pilot:pack`** пройдено (гейти A/C/D/CLI/TOOL) — доводить, що
   зміни в `plugin-sdk` і шаблоні плагіна не зламали пакування.

## Що НЕ входить в Е0 (щоб не було спокуси)

- Жодного рядка TanStack DB, колекцій, `useLiveQuery` — це Е1.
- Адмінка не чіпається взагалі: її 27 вставок переписуються в Е1+.
- `defineAdminResource`, `ENTITY`, `entityKey` — Е1.
- Storage-порт і `ImageUpload` — Е2.
- Поіменна класифікація всіх 45 таблиць у документі: класифікація
  **машинна** (гейт Task 4 тримає список Категорії B, решта — A за
  замовчуванням), список у плані застарів би за один PR.

## Точка передачі

Після закриття DoD — повернутись на валідацію: показати результат живого
прогону (п. 3–4) і вивід негативного контролю (п. 2). Наступний план —
**Е1: інфраструктура серверного шару + перша сутність наскрізь**
(`ENTITY`/`entityKey`, `defineAdminResource`, `subset.ts`, реєстр
колекцій, `QueryClient` у router context, дві тір-зони, `order_statuses`
наскрізь, гейти `mutation-cache-sync` / `handler-canon` /
`client-generated-ids` / `id-mismatch` / `entity-parity` /
`no-literal-query-key`). Він пишеться після того, як Е0 підтверджено —
бо форма fail-loud guard-а в Е1 спирається на інваріант, який Е0 щойно
встановив.
