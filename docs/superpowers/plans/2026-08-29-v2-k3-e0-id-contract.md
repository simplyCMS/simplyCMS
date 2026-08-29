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

## Передумова оточення (перевірити ДО Task 1)

Задачі 1–3 виконуються без бази; **Task 4 і весь DoD потребують живого
Postgres**. Харнес резолвить підключення двома шляхами (`test-harness/pg/up.mjs`):
`PG_HARNESS_URL` або ефемерний `initdb`/`pg_ctl`.

🔴 Ефемерний фолбек працює **не скрізь** — це відкритий борг К1а-2
(«перевірено лише в цьому контейнері: root + доступний `su postgres` +
PG у стандартному шляху»). Якщо `command -v initdb` порожній, фолбек
недоступний і `PG_HARNESS_URL` **обов'язковий**.

```bash
# 1. Чи є локальні бінарники PG (якщо так — фолбек спрацює сам):
for b in initdb pg_ctl psql; do printf '%-8s %s\n' "$b" "$(command -v $b || echo MISSING)"; done

# 2. Якщо MISSING — підняти/знайти контейнер і взяти з нього доступи:
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i postgres
docker inspect <ім'я> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_

# 3. Скласти рядок і ПЕРЕВІРИТИ конект перед роботою:
export PG_HARNESS_URL='postgresql://<user>@127.0.0.1:<порт>/postgres'
node -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.PG_HARNESS_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('OK');return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

Приклад робочого стенда цього репозиторію (станом на 2026-08-29):
контейнер `simplycms-041-pg`, образ `pgvector/pgvector:pg17`, trust-auth,
користувач `pgtest`, порт `55433` →
`PG_HARNESS_URL='postgresql://pgtest@127.0.0.1:55433/postgres'`.
🔴 Це **знімок середовища, не контракт** — порт і користувач у іншому
оточенні інші, тому крок 2 обов'язковий, а не декоративний.

---

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts` | Гейт: серверні вставки Категорії A несуть явний `id`; Категорія B — ні |
| `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts` | Гейт: обидва сіди детерміновані, UUID унікальні |
| `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts` | Гейт: `DEFAULT` лише в Категорії B (з негативним контролем) |
| `packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts` | Гейт: порт плагіна кидає без `id` |
| `tests/admin-inserts-need-id.test.ts` | Ратчет застарілого шару адмінки |
| `packages/cli/template-plugin/migrations/0001_init.sql` | Шаблон міграції плагіна (**його не існувало**) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `test-harness/pg/__tests__/fixtures/*.ts` (5 файлів) | ~23 вставки без `id` → явні UUID |
| `src/storefront/loaders/{order-create,reviews-write,addresses,recipients}.ts` | явний `id`; в `order-create` ще й `return` без `row` |
| `src/auth/provision.ts` | явний `id` для `profiles`, `userRoles` |
| `src/auth/invite-store.ts` | явний `id` **лише** для `userRoles` |
| `src/themes/server/registry-db.ts`, `src/plugins/server/registry-db.ts` | явний `id` |
| `migrations/0003_seed.sql`, `migrations/demo/demo-seed.sql` | статичні UUID; **дані не змінюються** |
| `migrations/0001_init.sql` | `DROP DEFAULT` на Категорії A + `COMMENT ON COLUMN` |
| `migrations/0002_grants.sql:186-189` | стале пояснення про сиквенси |
| `src/schema/schema.ts`, `src/schema/media.ts` | зняти `.defaultRandom()` |
| `drizzle/0000_init.sql`, `drizzle/meta/` | регенерація (інакше `db:diff` бачить дрейф) |
| `packages/create-simplycms-store/template/**` | `pnpm template:sync` після правки міграцій |
| `src/plugin-sdk/{usePluginTable.ts,server/table-db.ts}` | `id` обов'язковий |
| `src/plugin-sdk/__tests__/usePluginTable.test.tsx`, `test-harness/pg/__tests__/plugin-port.test.ts` | оновити виклики, DDL тестової таблиці й фікстуру |
| `packages/simplycms-plugin-faq/**` | генерація id у UI, DDL без DEFAULT |
| `scripts/pilot-pack/seed-sql.mjs`, `supabase/seed.sql` | стабільні id (`pnpm pilot:seed`) |
| `docs/tasks/platform-roadmap.md` | борг К0-9 — дописати несумісність `content-loader-mcp` |

**Свідомо НЕ чіпаються:** `packages/simplycms/src/admin/**` — 27 вставок
застарілого шару (рішення власника 2026-08-29). Вони ходять через
`supabase-js`, на чистому Postgres не виконуються й переписуються в
Е1–Е6; замість правки — ратчет у Task 5.

---

# Етап Е0 — контракт id

Порядок жорсткий і **не переставляється**: спершу всі шляхи вставки
починають передавати `id` (Tasks 0–3), і лише потім знімається DEFAULT
(Task 4). Зворотний порядок поклав би і вітрину, і весь `test:schema`.

🔴 **Ревізія 1 (2026-08-29) за результатами зовнішнього аудиту.** Перша
редакція плану мала шість блокерів: не бачила 23 вставки у фікстурах
харнеса, не кликала `template:sync` після правки міграцій, пропускала три
серверні insert-шляхи, стирала власну роботу в негативному контролі,
посилалась на неіснуючий шаблон міграції плагіна і **вигадувала вміст
сіду**. Усе виправлено нижче; звідси Task 0 і Task 5, яких не було.

### Task 0: Фікстури харнеса — явні id

**Files:**
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/rls-actors.ts`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/showcase.ts`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/shipping.ts`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront.ts`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront-client.ts`

**Interfaces:**
- Consumes: нічого нового.
- Produces: фікстури, придатні до схеми без DEFAULT. Task 4 без цього
  завалить **увесь** `test:schema`, а не лише власний тест.

🔴 Це задача-передумова, знайдена аудитом. У п'яти файлах — **50**
`insert into`, з них приблизно **23 без явного `id`** (`rls-actors` 17
вставок / ~4 з id, `showcase` 19 / ~13, `shipping` 6 / ~4,
`storefront` 4 / ~3, `storefront-client` 4 / ~3). Точні числа порахувати
на місці — регекс-оцінка тут орієнтир, не контракт.

- [ ] **Step 1: Порахувати фактичний обсяг**

```bash
cd packages/simplycms/test-harness/pg/__tests__/fixtures
for p in *.ts; do
  printf '%-22s insert=%s\n' "$p" "$(grep -c 'insert into' "$p")"
done
grep -n "insert into" *.ts | wc -l
```

Виписати кожен `insert into`, що НЕ містить `id` у списку колонок.

- [ ] **Step 2: Переконатись, що зараз усе зелене**

Run: `pnpm test:schema`
Expected: PASS. Це базова лінія — після Task 0 вона мусить лишитись
зеленою (фікстури з явним `id` працюють і зі старим DEFAULT).

- [ ] **Step 3: Проставити явні UUID у кожній вставці без id**

Стиль — той, що вже вживається в `rls-actors.ts`: іменована константа
зверху файлу, потім підстановка. Для рядків, на які нічого не
посилається, годиться `gen_random_uuid()` прямо у `values`.

```ts
// на початку файлу — константи для рядків, на які є посилання
const SECTION_A = '10000000-0000-4000-8000-000000000001';
const PRODUCT_A = '10000000-0000-4000-8000-000000000002';

// у вставці — id першою колонкою
await queryInTransaction(dbUrl, [
  `insert into public.sections (id, name, slug, is_active)
     values ('${SECTION_A}', 'Секція A', 'section-a', true)`,
  `insert into public.products (id, section_id, name, slug, is_active)
     values ('${PRODUCT_A}', '${SECTION_A}', 'Товар A', 'product-a', true)`,
]);
```

🔴 Де рядок ні з чим не пов'язаний — `gen_random_uuid()` у `values`
допустимий: це явна вставка значення, а не покладання на DEFAULT колонки,
тож Task 4 її не зачепить.

- [ ] **Step 4: Гейт лишився зеленим**

Run: `pnpm test:schema`
Expected: PASS — та сама кількість тестів, що в Step 2.

- [ ] **Step 5: Коміт**

```bash
git add packages/simplycms/test-harness/pg/__tests__/fixtures
git commit -m "test(v2-k3): фікстури харнеса — явні id замість DEFAULT

Передумова Task 4: після DROP DEFAULT вставка без id падає 23502, і це
поклало б увесь test:schema, а не лише новий тест. Знайдено зовнішнім
аудитом плану.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: Серверні вставки передають id явно

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/order-create.ts` (вставки + `return`)
- Modify: `packages/simplycms/src/storefront/loaders/reviews-write.ts`
- Modify: `packages/simplycms/src/storefront/loaders/addresses.ts`
- Modify: `packages/simplycms/src/storefront/loaders/recipients.ts`
- Modify: `packages/simplycms/src/auth/provision.ts` (`profiles`, `userRoles`)
- Modify: `packages/simplycms/src/auth/invite-store.ts` (**лише** `userRoles`)
- Modify: `packages/simplycms/src/themes/server/registry-db.ts`
- Modify: `packages/simplycms/src/plugins/server/registry-db.ts`
- Test: `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`

**Interfaces:**
- Consumes: `randomUUID` з `node:crypto` (в `order-create.ts` уже імпортований — **не** дублювати імпорт).
- Produces: усі серверні вставки Категорії A несуть `id`.

🔴 Три останні файли додано аудитом — перша редакція їх не бачила.
🔴 В `invite-store.ts` міняється **тільки** вставка `userRoles`: вставки в
`users` і `verifications` — Категорія B (Better Auth делегує генерацію
базі), їх чіпати не можна.

- [ ] **Step 1: Написати падаючий тест**

Наївний скан «600 символів після `.insert(table)`» дає хибні проходження —
ловить `return { id: row.id }` і `.returning({ id: … })`. Тому тест
структурно вирізає саме аргумент `.values(...)`.

```ts
// packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../../src');

/** Серверні вставки в таблиці Категорії A. Файл → drizzle-таблиця. */
const CATEGORY_A_INSERTS = [
  ['storefront/loaders/order-create.ts', 'orders'],
  ['storefront/loaders/order-create.ts', 'orderItems'],
  ['storefront/loaders/reviews-write.ts', 'productReviews'],
  ['storefront/loaders/addresses.ts', 'userAddresses'],
  ['storefront/loaders/recipients.ts', 'userRecipients'],
  ['auth/provision.ts', 'profiles'],
  ['auth/provision.ts', 'userRoles'],
  ['auth/invite-store.ts', 'userRoles'],
  ['themes/server/registry-db.ts', 'themes'],
  ['plugins/server/registry-db.ts', 'plugins'],
] as const;

/**
 * Вирізає текст аргументу першого `.values(` після `.insert(<table>)`,
 * рахуючи дужки. Без цього скан ловить `.returning({ id: … })` і
 * `return { id: row.id }`, тобто дає хибне проходження (знахідка аудиту).
 */
function valuesArgument(src: string, table: string): string | null {
  const insertAt = src.indexOf(`.insert(${table})`);
  if (insertAt < 0) return null;
  const valuesAt = src.indexOf('.values(', insertAt);
  if (valuesAt < 0) return null;

  let depth = 0;
  const from = valuesAt + '.values('.length - 1;
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(from + 1, i);
    }
  }
  return null;
}

describe('Е0: серверні вставки передають id явно', () => {
  it.each(CATEGORY_A_INSERTS)('%s → %s', (file, table) => {
    const src = readFileSync(resolve(SRC, file), 'utf8');
    const values = valuesArgument(src, table);
    expect(values, `не знайдено .insert(${table}).values(...) у ${file}`).not.toBeNull();
    expect(
      values!,
      `.insert(${table}) у ${file} не передає id у values(...)`,
    ).toMatch(/(^|[\s{,])id:\s*\S/);
  });
});

describe('Е0: Категорія B id НЕ передає', () => {
  it.each([
    ['auth/invite-store.ts', 'users'],
    ['auth/invite-store.ts', 'verifications'],
  ] as const)('%s → %s лишається на DEFAULT', (file, table) => {
    const src = readFileSync(resolve(SRC, file), 'utf8');
    const values = valuesArgument(src, table);
    if (values === null) return; // вставки може не бути — це не помилка
    expect(
      values,
      `${table} — Категорія B: id генерує БД, Better Auth його не шле`,
    ).not.toMatch(/(^|[\s{,])id:\s*\S/);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: FAIL у першому describe. 🔴 Кількість падінь **виписати** — це
базова лінія; аудит показав, що наївний скан давав 4 замість 10, тож
переконайся, що падають саме ті кейси, які ще не мають `id`.

- [ ] **Step 3: Додати id у кожну вставку**

```ts
// order-create.ts — randomUUID УЖЕ імпортований на рядку 1, не дублювати.
// Ключ батька відомий до вставки, тож .returning() більше не потрібен.
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

// 🔴 Знахідка аудиту: `return` нижче посилався на `row`, який зникає
// разом із `.returning()`. Повертаємо вже відомі значення.
return { id: orderId, orderNumber, accessToken };
```

```ts
// themes/server/registry-db.ts — вставка масиву
await db.insert(themes).values(
  missing.map((entry) => ({
    id: randomUUID(),
    slug: entry.manifest.slug,
    // …решта полів без змін
  })),
);
```

Так само: `plugins/server/registry-db.ts` (`plugins`), `invite-store.ts`
(**тільки** `userRoles`), `provision.ts` (`profiles`, `userRoles`),
`reviews-write.ts`, `addresses.ts`, `recipients.ts`. У кожному файлі,
де `randomUUID` ще не імпортований, додати `import { randomUUID } from 'node:crypto';`.

🔴 `addresses.ts` і `recipients.ts` використовують `.returning({ id: … })`
— його можна лишити або замінити на відому константу; тест дивиться
лише на `values(...)`.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: PASS, 12/12 (10 у першому describe + 2 у другому).

- [ ] **Step 5: Типи й гейти**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. 🔴 `typecheck` тут обов'язковий — саме він спіймає
забутий `row` після видалення `.returning()`.

- [ ] **Step 6: Живий доказ**

```bash
export PG_HARNESS_URL='postgresql://<user>@127.0.0.1:<порт>/postgres'
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s localhost:3141/api/health; echo
```
Expected: `{"status":"healthy",...}`.

- [ ] **Step 7: Коміт**

```bash
git add packages/simplycms/src packages/simplycms/test-harness
git commit -m "feat(v2-k3): серверні вставки передають id явно

Передумова зняття DEFAULT. Охоплює всі десять шляхів Категорії A,
включно з трьома, яких перша редакція плану не бачила (invite-store
userRoles, registry-db тем і плагінів). Заразом прибрано .returning()
в order-create — id замовлення тепер відомий до вставки.

Вставки users/verifications свідомо лишились без id: Better Auth
делегує генерацію базі, і тест це фіксує окремим describe.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 2: Сіди отримують статичні UUID

**Files:**
- Modify: `packages/simplycms/migrations/0003_seed.sql`
- Modify: `packages/simplycms/migrations/demo/demo-seed.sql`
- Test: `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`

**Interfaces:**
- Produces: стабільні UUID сіду — на них зможе спиратися e2e (борг №4
  роадмапу: сім динамічних роутів адмінки).

🔴 **Дані сіду НЕ змінюються — додається лише колонка `id`.** Перша
редакція плану вигадала п'ять статусів замість шести й підмінила коди;
`baseline.test.ts:190` асертить `statuses: 6`, тож це впало б одразу.
Нижче наведено **фактичний** вміст із доданими ключами.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

const SEEDS = [
  ['0003_seed.sql', resolve(MIGRATIONS, '0003_seed.sql')],
  ['demo/demo-seed.sql', resolve(MIGRATIONS, 'demo/demo-seed.sql')],
] as const;

/**
 * Вирізає список колонок кожного `insert into … ( … )`. Дивитись треба
 * саме на нього: скан «чи є десь id» ловив би `select s.id` у підзапиті
 * резолву FK і давав хибне проходження (знахідка аудиту).
 */
function insertColumnLists(sql: string): { table: string; columns: string }[] {
  const out: { table: string; columns: string }[] = [];
  const re = /insert\s+into\s+([a-z_.]+)\s*\(([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ table: m[1], columns: m[2] });
  }
  return out;
}

describe('Е0: сід детермінований', () => {
  it.each(SEEDS)('%s — кожен INSERT називає колонку id', (label, path) => {
    const sql = readFileSync(path, 'utf8');
    const inserts = insertColumnLists(sql);
    expect(inserts.length, `у ${label} не знайдено жодного INSERT`).toBeGreaterThan(0);
    for (const { table, columns } of inserts) {
      expect(
        columns,
        `${label}: insert into ${table} без колонки id → покладається на DEFAULT`,
      ).toMatch(/(^|[\s,])id([\s,]|$)/);
    }
  });

  it.each(SEEDS)('%s — UUID-літерали унікальні', (label, path) => {
    const sql = readFileSync(path, 'utf8');
    const uuids =
      sql.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi) ?? [];
    expect(uuids.length, `${label}: немає UUID-літералів`).toBeGreaterThan(0);
    expect(new Set(uuids).size, `${label}: дубльовані UUID`).toBe(uuids.length);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: FAIL, 4 кейси (обидва файли × обидва твердження).

- [ ] **Step 3: Проставити статичні UUID, НЕ змінюючи дані**

Схема нумерації: префікс за таблицею, суфікс — номер рядка.

```sql
insert into public.order_statuses (id, name, code, color, sort_order, is_default)
values
  ('00000001-0000-4000-8000-000000000001', 'Новий',        'new',        '#3B82F6', 0, true),
  ('00000001-0000-4000-8000-000000000002', 'Підтверджено', 'confirmed',  '#10B981', 1, false),
  ('00000001-0000-4000-8000-000000000003', 'В обробці',    'processing', '#F59E0B', 2, false),
  ('00000001-0000-4000-8000-000000000004', 'Відправлено',  'shipped',    '#8B5CF6', 3, false),
  ('00000001-0000-4000-8000-000000000005', 'Доставлено',   'delivered',  '#22C55E', 4, false),
  ('00000001-0000-4000-8000-000000000006', 'Скасовано',    'cancelled',  '#EF4444', 5, false)
on conflict (code) do nothing;

insert into public.languages (id, code, name, is_default, is_active)
values ('00000002-0000-4000-8000-000000000001', 'uk', 'Українська', true, true)
on conflict (code) do nothing;

insert into public.price_types (id, name, code, is_default, sort_order)
values ('00000003-0000-4000-8000-000000000001', 'Роздрібна', 'retail', true, 0)
on conflict (code) do nothing;

-- 🔴 FK і далі резолвиться ПІДЗАПИТОМ за натуральним ключем, а не
-- константою: на БД, яка вже мала сід, price_types має старий випадковий
-- id, і `on conflict do nothing` не замінить його на нову константу —
-- константа у FK впала б (знахідка аудиту).
insert into public.user_categories (id, name, code, is_default, price_type_id)
select
  '00000004-0000-4000-8000-000000000001',
  'Роздріб',
  'retail',
  true,
  (select id from public.price_types where code = 'retail')
on conflict (code) do nothing;

insert into public.system_settings (id, key, value, description)
values
  (
    '00000005-0000-4000-8000-000000000001',
    'active_theme', '"default"'::jsonb, 'Активна тема сайту'
  ),
  (
    '00000005-0000-4000-8000-000000000002',
    'stock_management',
    '{"decrease_on_order": false}'::jsonb,
    'Налаштування управління залишками'
  )
on conflict (key) do nothing;

insert into public.themes (id, name, display_name, version, description, author, is_active)
values (
  '00000006-0000-4000-8000-000000000001',
  'default', 'Default', '1.0.0', 'Базова тема SimplyCMS', 'SimplyCMS', true
)
on conflict (name) do nothing;
```

`demo/demo-seed.sql` — за тим самим правилом: **власним** рядкам дати
константні `id` (префікси `10000001…`, `10000002…` тощо), а посилання на
батьків лишити підзапитами за slug/code.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Дані не змінились — довести накатом**

```bash
pnpm test:schema
```
Expected: PASS, у тому числі `baseline.test.ts` з `{ statuses: 6, themes: 1, settings: 2 }`.
🔴 Якщо тут `statuses` не 6 — сід змінили, а не переключили на явні ключі.

- [ ] **Step 6: Ідемпотентність — двічі поспіль**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
```
Expected: другий прогін без помилок, кількість рядків не подвоїлась.

- [ ] **Step 7: Коміт**

```bash
git add packages/simplycms/migrations packages/simplycms/test-harness
git commit -m "feat(v2-k3): детермінований сід — статичні UUID

Дані сіду НЕ змінені: ті самі шість статусів, мова, тип ціни, категорія,
дві системні настройки й тема — додано лише колонку id. FK і далі
резолвляться підзапитом за натуральним ключем, інакше на вже засіяній БД
константа не збіглася б із наявним рядком.

Закриває борг №4 роадмапу: сім динамічних роутів адмінки поза e2e
потребували стабільних id із сіду.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Контракт плагінів вимагає id

**Files:**
- Modify: `packages/simplycms/src/plugin-sdk/usePluginTable.ts`
- Modify: `packages/simplycms/src/plugin-sdk/server/table-db.ts`
- Modify: `packages/simplycms/src/plugin-sdk/__tests__/usePluginTable.test.tsx:79,99`
- Modify: `packages/simplycms/test-harness/pg/__tests__/plugin-port.test.ts:43,50,82`
- Modify: `packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql:15`
- Modify: `packages/simplycms-plugin-faq/src/pages/FaqAdmin.tsx`
- Create: `packages/cli/template-plugin/migrations/0001_init.sql`
- Modify: `packages/cli/src/create-scaffold.mjs` (якщо шаблон міграції треба зареєструвати явно)
- Test: `packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts`
- Test: `tests/cli-create.test.ts` (перевірка DDL шаблону)

**Interfaces:**
- Produces: `PluginTablePort.insert(row: Partial<Row> & { id: string })`;
  `insertPluginRow` кидає без `id`.

🔴 Дві знахідки аудиту врахувано: теки `packages/cli/template-plugin/migrations/`
**не існує** (там лише `README.md`, `index.ts`, `messages.ts`,
`package.json.tpl`), тож шаблон треба **створити**, а не правити; і зміна
контракту ламає **наявні** тести, які перша редакція не оновлювала.

- [ ] **Step 1: Написати падаючий тест**

```ts
// packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts
import { describe, expect, it, vi } from 'vitest';
import { insertPluginRow } from '../server/table-db';

vi.mock('simplycms/storefront/loaders', () => ({
  withStorefrontDb: vi.fn(),
  withStoreOperatorDb: vi.fn(),
}));

describe('порт плагіна: id обовʼязковий', () => {
  it('insertPluginRow без id кидає з поясненням', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q', answer: 'a' }),
    ).rejects.toThrow(/id/i);
  });

  it('повідомлення називає таблицю і плагін', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { question: 'q' }),
    ).rejects.toThrow(/plg_faq_items/);
  });

  it('порожній рядок як id теж відхиляється', async () => {
    await expect(
      insertPluginRow('faq', 'plg_faq_items', { id: '', question: 'q' }),
    ).rejects.toThrow(/id/i);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/plugin-sdk/__tests__/plugin-table-id.test.ts`
Expected: FAIL, 3 кейси — вставка не кидає.

- [ ] **Step 3: Зробити id обов'язковим**

```ts
// server/table-db.ts — перевірка ПЕРЕД guardedTable, щоб помилка
// контракту не маскувалась помилкою доступу
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
// usePluginTable.ts
export interface PluginTablePort<Row extends Record<string, unknown>> {
  list(options?: { orderBy?: string; ascending?: boolean; eq?: Partial<Row> }): Promise<Row[]>;
  /** 🔴 `id` генерує викликач: ключ мусить бути відомий до відповіді сервера. */
  insert(row: Partial<Row> & { id: string }): Promise<Row>;
  update(id: string, patch: Partial<Row>): Promise<Row>;
  remove(id: string): Promise<void>;
}
```

- [ ] **Step 4: Оновити наявних споживачів**

```tsx
// packages/simplycms-plugin-faq/src/pages/FaqAdmin.tsx
await table.insert({
  id: crypto.randomUUID(),
  question,
  answer,
  product_id: productId,
  sort_order: sortOrder,
  is_active: true,
});
```

```sql
-- packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql:15
  id uuid primary key,   -- 🔴 без default: ключ приходить від клієнта
```

Наявні тести — додати `id` у виклики: `usePluginTable.test.tsx:79` і `:99`,
`plugin-port.test.ts:82`. У `plugin-port.test.ts` також прибрати
`DEFAULT gen_random_uuid()` з DDL тестової таблиці (`:43`) і додати `id`
у фікстуру `plugins` (`:50`).

- [ ] **Step 5: Створити шаблон міграції плагіна**

Теки `migrations/` у `packages/cli/template-plugin/` немає — створити:

```sql
-- packages/cli/template-plugin/migrations/0001_init.sql
-- Власна таблиця плагіна. Межа даних — префікс plg_<name>_ (спека §7/§9).
create table if not exists plg___PLUGIN_KEY___items (
  -- 🔴 Без DEFAULT: ключ генерує клієнт (crypto.randomUUID()) і шле в
  -- insert. Інакше оптимістичний рядок і серверний розійдуться ключами.
  id uuid primary key,
  title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

Перевірити, чи `create-scaffold.mjs` копіює теку автоматично
(`copyTemplateDirectory`) — якщо так, реєстрація не потрібна; якщо ні,
додати теку у список. Плейсхолдер ключа взяти той самий, що вже вживає
скаффолдер (`packages/cli/src/create-scaffold.mjs:34,43`).

Додати перевірку в `tests/cli-create.test.ts`: згенерований плагін має
файл міграції, і в ньому **немає** `default gen_random_uuid()`.

- [ ] **Step 6: Запустити все**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS, 0 errors. 🔴 Особливо — `usePluginTable.test.tsx` і
`plugin-port.test.ts` (їх щойно оновили).

- [ ] **Step 7: Коміт**

```bash
git add packages/simplycms/src/plugin-sdk packages/simplycms/test-harness \
        packages/simplycms-plugin-faq packages/cli tests
git commit -m "feat(v2-k3)!: порт плагінів вимагає клієнтський id

BREAKING CHANGE: PluginTablePort.insert вимагає row.id; plg_* таблиці
створюються без DEFAULT. Створено шаблон міграції плагіна, якого досі не
існувало, — без нього вимога К3-11 щодо scaffold DDL була невиконанною.
Оновлено наявних споживачів: usePluginTable.test, plugin-port.test (DDL
і фікстура), FaqAdmin.

Робиться зараз, бо вікно закривається на К5: після відкриття подач
маркетплейсу контракт заморожує перший сторонній пакет.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
### Task 4: DROP DEFAULT у baseline + гейт у test:schema

**Files:**
- Modify: `packages/simplycms/migrations/0001_init.sql` (Категорія A)
- Modify: `packages/simplycms/migrations/0002_grants.sql:186-189` (стале пояснення)
- Modify: `packages/simplycms/src/schema/schema.ts` (зняти `.defaultRandom()`)
- Modify: `packages/simplycms/src/schema/media.ts:45` (**та сама зміна**)
- Modify: `packages/simplycms/drizzle/0000_init.sql` + `drizzle/meta/` (регенерація)
- Test: `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts`

**Interfaces:**
- Consumes: харнес (`resolveHarness` з `up.mjs`; `applySqlFiles`,
  `createTempDatabase`, `dropTempDatabase`, `queryRows`, `randomDbName`,
  `withDbName` з `apply.mjs`). 🔴 `queryRows` повертає **масив рядків**,
  не `{ rows }`.
- Produces: інваріант «Категорія A без DEFAULT».

🔴 Три знахідки аудиту врахувано: `schema/media.ts` має власне
`.defaultRandom()` і його теж треба зняти, інакше Drizzle-модель
розійдеться з БД; артефакти `drizzle/` збережуть старі defaults і
наступний `db:diff` побачить дрейф; правка міграцій ламає
`create-store-template-parity` без `pnpm template:sync`.

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
  readdirSync(CANON_DIR).filter((n) => n.endsWith('.sql')).sort()
    .map((n) => join(CANON_DIR, n));

/**
 * Категорія B — DEFAULT лишається КОНСТРУКТИВНО:
 *  • таблиці Better Auth: `generateId:'uuid'` + `supportsUUIDs` драйвера
 *    означає, що BA не кладе id в INSERT узагалі (`auth/instance.ts:78-87`);
 *  • `orders`: створює сервер із атомарним `order_number`.
 */
const CATEGORY_B = new Set([
  'users', 'sessions', 'accounts', 'verifications', 'orders',
]);

/**
 * 🔴 `has_default` — це ФАКТ наявності DEFAULT (`d.oid is not null`), а не
 * збіг із `gen_random_uuid`. Знахідка аудиту: перевірка через ILIKE
 * пропустила б `uuid_generate_v4()` чи літерал, тобто гейт мовчав би саме
 * там, де мав спрацювати. Вираз лишаємо окремою колонкою — для діагностики.
 */
const ID_DEFAULTS_SQL = `
  select c.relname                                as table_name,
         (d.oid is not null)                      as has_default,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '') as default_expr
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
      .map((r) => `${r.table_name} (${r.default_expr})`)
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
Expected: FAIL — перший кейс перелічує 40 таблиць Категорії A.
🔴 Записати точне число: воно знадобиться в Step 5.

- [ ] **Step 3: Зняти DEFAULT у baseline, схемі та drizzle-артефактах**

У `0001_init.sql` для кожної таблиці Категорії A:

```sql
	"id" uuid PRIMARY KEY NOT NULL,
```

(було `… PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL`). П'ять таблиць
Категорії B лишаються як є.

Коментарі-інваріанти наприкінці файлу:

```sql
COMMENT ON COLUMN "products"."id" IS 'Категорія A: client-generated UUID. DEFAULT знято навмисно — fail-loud guard проти розсинхрону оптимістичного й серверного ключа.';
COMMENT ON COLUMN "orders"."id"   IS 'Категорія B: id генерує сервер разом із атомарним order_number. DEFAULT свідомо збережено.';
```

У `schema.ts` — прибрати `.defaultRandom()` у Категорії A:

```ts
export const orderStatuses = pgTable("order_statuses", {
	id: uuid().primaryKey().notNull(),
	// …решта без змін
});
```

🔴 **`schema/media.ts:45` — окремий файл, та сама зміна:**

```ts
    id: uuid().primaryKey().notNull(),
```

Оновити `0002_grants.sql:186-189`: сиквенсів немає не тому, що «всі PK —
uuid з `gen_random_uuid()`», а тому, що тип PK лишається `uuid`.

Перегенерувати артефакти Drizzle (`drizzle/0000_init.sql`,
`drizzle/meta/`) канонічним процесом — інакше наступний `db:diff` побачить
дрейф. Якщо регенерація дає ширший діф, ніж очікувано, — зупинитись і
звірити: baseline канону лишається джерелом правди.

- [ ] **Step 4: Синхронізувати шаблон і запустити гейт**

🔴 Міграції під `create-store-template-parity` (звіряє `SCHEMA_MIGRATIONS_DIR`
байт-у-байт). Без цього кроку `pnpm test` червоний.

```bash
pnpm template:sync
pnpm test:schema
pnpm test
```
Expected: `test:schema` PASS (обидва кейси), `test` PASS (parity зелений).

- [ ] **Step 5: Негативний контроль**

🔴 **Не використовувати `git checkout` — Task 4 ще не закомічений, і
відкат файлу стер би всі щойно зроблені `DROP DEFAULT`** (знахідка
аудиту: перша редакція саме так і робила, тобто крок знищував задачу).

```bash
# 1. Точкова правка ОДНІЄЇ таблиці Категорії A — повернути DEFAULT:
python3 - <<'PATCH'
import pathlib, re
p = pathlib.Path('packages/simplycms/migrations/0001_init.sql')
t = p.read_text(encoding='utf-8')
marker = 'CREATE TABLE "banners"'
i = t.index(marker)
j = t.index('"id" uuid PRIMARY KEY NOT NULL,', i)
p.write_text(
    t[:j] + '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,' + t[j + len('"id" uuid PRIMARY KEY NOT NULL,'):],
    encoding='utf-8')
print('DEFAULT повернено таблиці banners')
PATCH

# 2. Гейт МУСИТЬ почервоніти рівно на цій таблиці:
pnpm test:schema
# Expected: FAIL — 'DEFAULT на id у Категорії A: banners (gen_random_uuid())'

# 3. Відкотити ТОЧКОВО (не git checkout!):
python3 - <<'PATCH'
import pathlib
p = pathlib.Path('packages/simplycms/migrations/0001_init.sql')
t = p.read_text(encoding='utf-8')
p.write_text(t.replace('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,',
                       '"id" uuid PRIMARY KEY NOT NULL,', 1)
             if 'CREATE TABLE "banners"' in t else t, encoding='utf-8')
print('відкочено')
PATCH

# 4. Переконатись, що позитивний стан повернувся:
pnpm test:schema
```
Expected: крок 2 — FAIL із назвою `banners`; крок 4 — PASS.

🔴 Якщо на кроці 2 гейт лишився зеленим — він нічого не доводить, і етап
не можна закривати. Це той самий клас сліпоти, що дав борги К1а-9 і 0.4.1-5.

⚠️ Точковий відкат у кроці 3 замінює **перше** входження — переконайся
`git diff`, що змінена рівно одна таблиця й решта `DROP DEFAULT` на місці.

- [ ] **Step 6: Повний ланцюг гейтів і живий магазин**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
  && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
  && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/catalog; echo
```
Expected: усе PASS; обидві сторінки `200`.

- [ ] **Step 7: Коміт**

```bash
git add packages/simplycms/migrations packages/simplycms/src/schema \
        packages/simplycms/drizzle packages/simplycms/test-harness \
        packages/create-simplycms-store/template
git commit -m "feat(v2-k3)!: DROP DEFAULT на id Категорії A + гейт

BREAKING CHANGE: baseline більше не генерує id для таблиць, які створює
клієнт. Забутий id падає 23502 у момент помилки, а не мовчки розходиться
ключем з оптимістичним рядком. Категорія B (Better Auth, orders) DEFAULT
зберігає конструктивно — див. COMMENT ON COLUMN.

Гейт перевіряє ФАКТ наявності DEFAULT (d.oid is not null), а не збіг із
gen_random_uuid: інакше uuid_generate_v4() чи літерал пройшли б повз.
Негативний контроль — точкова правка однієї таблиці, без git checkout.

Синхронізовано шаблон (template:sync) і артефакти drizzle; media.ts
знято з defaultRandom разом зі schema.ts.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Гейт на нові вставки + сід пілота

**Files:**
- Modify: `scripts/pilot-pack/seed-sql.mjs`
- Regenerate: `supabase/seed.sql` (через `pnpm pilot:seed`)
- Test: `tests/admin-inserts-need-id.test.ts`

**Interfaces:**
- Consumes: `ENTITY`-незалежний текстовий скан (реєстру сутностей у Е0 ще немає).
- Produces: гейт, що не дає новій вставці без `id` з'явитись у застарілому шарі.

🔴 **Рішення власника (2026-08-29):** 27 вставок у `src/admin/**` **не
чіпаємо** — вони ходять через `supabase-js`, якого на чистому Postgres
немає, тобто не виконуються за жодних умов, і всі переписуються в Е1–Е6.
Замість правки ставимо гейт, який червонітиме на **новій** вставці без
`id`, і фіксуємо наявні 27 іменованим списком-виїмкою.

- [ ] **Step 1: Написати тест-ратчет**

```ts
// tests/admin-inserts-need-id.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ADMIN = resolve(import.meta.dirname, '../packages/simplycms/src/admin');

/**
 * Ратчет застарілого шару. Адмінка на supabase-js не виконується на
 * чистому Postgres і повністю переписується в Е1–Е6 (рішення власника
 * 2026-08-29), тому наявні вставки без `id` лишаються як є — але їхня
 * кількість може тільки ЗМЕНШУВАТИСЬ. Нова вставка валить тест.
 *
 * 🔴 Не «полагодити» цей файл додаванням нового рядка у список: кожен
 * запис звідси зникає разом із переписаною сторінкою.
 */
const KNOWN_WITHOUT_ID = 27;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

describe('застарілий шар адмінки: ратчет вставок без id', () => {
  it(`вставок без id не більше ніж ${KNOWN_WITHOUT_ID}`, () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(ADMIN)) {
      const src = readFileSync(file, 'utf8');
      const re = /\.insert\(\s*(\{|\[)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const chunk = src.slice(m.index, m.index + 400);
        if (!/(^|[\s{,])id:\s*\S/.test(chunk)) {
          offenders.push(`${relative(ADMIN, file)}@${m.index}`);
        }
      }
    }
    expect(
      offenders.length,
      `вставок без id: ${offenders.length}\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(KNOWN_WITHOUT_ID);
  });
});
```

- [ ] **Step 2: Запустити — має пройти на поточному стані**

Run: `pnpm vitest run tests/admin-inserts-need-id.test.ts`
Expected: PASS. 🔴 Якщо фактичне число інше за 27 — **виправити константу
на виміряне**, а не підганяти скан. Записати виміряне число.

- [ ] **Step 3: Негативний контроль**

Додати в будь-який файл адмінки тимчасову вставку без `id`
(`await supabase.from('banners').insert({ title: 'x' });`), запустити тест
— має ВПАСТИ з переліком. Прибрати правку, запустити знову — PASS.

- [ ] **Step 4: Сід пілота — стабільні id**

`scripts/pilot-pack/seed-sql.mjs` рендерить `supabase/seed.sql` без `id`
(знахідка аудиту). Додати генерацію стабільних UUID у джерелі та
перегенерувати:

```bash
pnpm pilot:seed
git diff --stat supabase/seed.sql
```
Expected: у `supabase/seed.sql` кожен `insert into` називає колонку `id`.

Run: `pnpm test`
Expected: PASS, зокрема `tests/pilot-seed.test.ts` (парність фікстур і сіду).

- [ ] **Step 5: Зафіксувати відомий виняток**

`tools/content-loader-mcp` містить ~34 вставки без `id`, але це
**автономний npm-проєкт поза `pnpm-workspace.yaml`** (борг К0-9: він і
сьогодні не стартує без окремого `npm install`, його тести в гейти не
входять). Зміни контракту він не ламає, бо не виконується.

Дописати рядок у борг К0-9 роадмапу: «після Е0 інструмент ще й
несумісний із контрактом id — мігрувати разом із втягуванням у workspace
або формально вилучити».

- [ ] **Step 6: Коміт**

```bash
git add tests/admin-inserts-need-id.test.ts scripts/pilot-pack supabase/seed.sql \
        docs/tasks/platform-roadmap.md
git commit -m "test(v2-k3): ратчет вставок без id + стабільні id у сіді пілота

Застарілий шар адмінки свідомо не правиться (рішення власника): він
ходить через supabase-js, на чистому Postgres не виконується і
переписується в Е1–Е6. Замість правки — ратчет: наявні вставки без id
дозволені, нова валить тест.

Сід пілота перегенеровано зі стабільними id. content-loader-mcp
зафіксовано як відомий виняток у борзі К0-9 — він поза workspace і в
гейти не входить.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
## DoD етапу Е0

Етап закритий, коли **всі** пункти виконані й перевірені:

1. **Повний ланцюг гейтів зелений:**
   ```bash
   pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
     && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
     && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
   ```
   `pnpm lint` = 0 errors. 🔴 `pnpm test` включно з
   `create-store-template-parity` — тобто `pnpm template:sync` виконано.

2. **Обидва негативні контролі відпрацювали:**
   - Task 4 Step 5 — повернений DEFAULT одній таблиці Категорії A червонить
     `test:schema` з її іменем; після точкового відкату гейт знову зелений.
   - Task 5 Step 3 — додана вставка без `id` в адмінці валить ратчет.

   Без цих двох перевірок гейти не доведені, і етап **не закривається**.

3. **Живий прогін** (канон репо — доводить прогін, не зелений CI):
   ```bash
   PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
   pnpm build && PORT=3141 pnpm start &
   curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/catalog \
     localhost:3141/cart localhost:3141/api/health; echo
   ```
   Expected: `200 200 200 200`.

4. **Наскрізний контур покупки прожитий вручну** — він містить найбільше
   нових `id`: додати товар у кошик → оформити замовлення → перевірити
   прямим SQL (HTTP-API до БД у контракті v2 немає):
   ```sql
   select o.order_number, count(i.id) as items
   from orders o join order_items i on i.order_id = o.id
   group by o.order_number order by o.created_at desc limit 1;
   ```
   Expected: рядок із ненульовою кількістю позицій.

5. **Сід ідемпотентний і не змінився за складом** — `pnpm db:demo` двічі
   поспіль не подвоює рядки; `baseline.test.ts` бачить
   `{ statuses: 6, themes: 1, settings: 2 }`.

6. **`pnpm pilot:pack`** пройдено (A/C/D/CLI/TOOL) — доводить, що зміни в
   `plugin-sdk`, шаблоні плагіна і сіді пілота не зламали пакування.

7. **`pnpm db:diff` не показує дрейфу** — артефакти `drizzle/`
   перегенеровані разом зі схемою.

## Що НЕ входить в Е0 (щоб не було спокуси)

- Жодного рядка TanStack DB, колекцій, `useLiveQuery` — це Е1.
- 27 вставок у `src/admin/**` — свідоме рішення власника (Task 5); вони
  переписуються разом зі сторінками в Е1–Е6.
- `defineAdminResource`, `ENTITY`, `entityKey` — Е1.
- Fail-loud перевірка secure context для `crypto.randomUUID()` — Е1,
  разом з рештою адмін-точок.
- Storage-порт і `ImageUpload` — Е2.
- `tools/content-loader-mcp` — поза workspace, у гейти не входить
  (борг К0-9).

## Точка передачі

Після закриття DoD — повернутись на валідацію з трьома артефактами:
вивід живого прогону (п. 3–4), вивід **обох** негативних контролів (п. 2)
і виміряне число вставок без `id` в адмінці (Task 5 Step 2).

Наступний план — **Е1: інфраструктура серверного шару + перша сутність
наскрізь** (`ENTITY`/`entityKey`, `defineAdminResource`, `subset.ts`,
реєстр колекцій, `QueryClient` у router context, дві тір-зони,
`order_statuses` наскрізь, гейти `mutation-cache-sync` / `handler-canon` /
`client-generated-ids` / `id-mismatch` / `entity-parity` /
`no-literal-query-key`). Він пишеться після підтвердження Е0: форма
fail-loud guard-а в Е1 спирається на інваріант, який Е0 щойно встановив.
