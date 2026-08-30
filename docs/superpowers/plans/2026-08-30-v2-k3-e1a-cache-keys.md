# V2-К3 · Етап Е1а: контракт ключів кешу і топологія QueryClient

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити чотири хвости Е0, звести ім'я сутності до єдиного джерела правди (Drizzle-схема) і перенести `QueryClient` у router context — тобто підготувати ґрунт, на який Е1б покладе серверний шар і колекції.

**Architecture:** Ім'я сутності більше не пишеться руками: реєстр `ENTITY` у T0 (плоскі рядки, нуль рантайм-залежностей) під тестом парності з `getTableName()` Drizzle-таблиць, а `entityKey()` будує з нього ключі єдиної форми. Вітринні ключі переводяться на цю фабрику й закриваються лінтом; ключі адмінки лишаються як є — вони зникнуть разом зі сторінками в Е1б–Е6. `QueryClient` переїжджає з `CMSProvider` у `getRouter()` і router context, бо `loader` роуту мусить дістати колекцію ще до рендера.

**Tech Stack:** TanStack Router 1.168 · TanStack Query 5.101 · Drizzle 0.45.2 · TypeScript 5.9 strict · Vitest 4 · ESLint 10

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — рішення К3-3 (ключі), К3-6 (id), К3-9 (розкладка); Додаток Б-2 (вимога префікса)

**Попередній етап:** [Е0 — контракт id](2026-08-29-v2-k3-e0-id-contract.md), прийнятий 2026-08-30 (гілка `claude/v2-k3-admin-server-layer`, HEAD `8fc06a53`). Валідовано незалежними прогонами, включно з обома негативними контролями.

**Обсяг:** перша половина етапу Е1. **TanStack DB тут ще немає** — жодної колекції, `useLiveQuery` чи нової залежності. Друга половина (Е1б: `admin-server`, `defineAdminResource`, `subset.ts`, реєстр колекцій, `order_statuses` наскрізь, гейти `mutation-cache-sync` / `handler-canon` / `id-mismatch`) пишеться після валідації цього.

**Чому саме такий розріз.** Топологія `QueryClient` зачіпає host-файли під `template:sync` — найризикованіша частина Е1, і прожити її треба **до** того, як на неї ляжуть колекції. Контракт ключів — передумова колекцій за побудовою: `queryKey` колекції має бути тим самим ключем, що й у решти запитів, інакше оновлення кешу проминає записи (Додаток Б-2 спеки).

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7.
- Коментарі й документація — **українською**; рядки інтерфейсу — тільки через i18n-каталоги.
- `pnpm lint` = **0 errors**, 12 warnings — чинна лінія, не зрушувати.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`.
- `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки `package.json`.
- Тіри: `contracts` = T0 (нуль рантайм-залежностей — `ENTITY` тому й рядки, а не Drizzle-таблиці).
- 🔴 Після будь-якої правки `packages/simplycms/migrations/**` або host-файлів — `pnpm template:sync`, інакше `create-store-template-parity` червоніє.
- Кожен новий гейт має **негативний контроль**, прогнаний вручну (урок К1а-9, 0.4.1-5).
- Breaking change дозволений: клієнтів і магазинів немає.
- Коміти українською, `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Передумова оточення

Локальних `initdb`/`pg_ctl`/`psql` **немає** — гейт схеми працює лише з готовим кластером:

```bash
export PG_HARNESS_URL='postgresql://pgtest@127.0.0.1:55433/postgres'
node -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.PG_HARNESS_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('OK');return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

🔴 Тести з `test-harness/**` запускаються **тільки** через
`pnpm vitest run --config vitest.schema.config.ts <path>` — кореневий
конфіг цю теку виключає, інакше «No test files found».

Приклад робочого стенда (знімок 2026-08-30, **не контракт**): контейнер
`simplycms-041-pg`, образ `pgvector/pgvector:pg17`, trust-auth, користувач
`pgtest`, порт `55433`.

---

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/src/contracts/entities.ts` | T0: реєстр `ENTITY` (рядки) + `entityKey()` |
| `packages/simplycms/src/contracts/__tests__/entity-key.test.ts` | Юніт форми ключів |
| `packages/simplycms/src/schema/__tests__/entity-parity.test.ts` | Гейт: `ENTITY` ≡ `getTableName()` усіх таблиць |
| `eslint.query-key-zone.mjs` | Зона заборони літерального `queryKey` |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/cli/template-plugin/migrations/0001___PLUGIN_TABLE_PREFIX__init.sql` | + два `grant` (хвіст 1) |
| `packages/simplycms/migrations/README.md` (+ копія в шаблоні) | прибрати опис неіснуючих `ALTER` (хвіст 2) |
| `packages/simplycms/migrations/0001_init.sql` | `orders` → Категорія A (хвіст 4) |
| `packages/simplycms/src/schema/schema.ts` | `orders.id` без `.defaultRandom()` |
| `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts` | `orders` виходить із `CATEGORY_B` |
| `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts` | звірка за значенням + `orders` (хвости 3, 4) |
| `packages/simplycms/src/react-query/queries.ts` | `catalogKeys` → через `entityKey` |
| `packages/simplycms/src/core/hooks/*.ts`, `src/*-ui/**` | 13 вітринних ключів → `entityKey` |
| `src/router.tsx`, `src/routes/__root.tsx` (+ канон `packages/cli/host/src/`) | `QueryClient` у router context |
| `packages/simplycms/src/core/providers/CMSProvider.tsx` | приймає клієнт із контексту |
| `packages/simplycms/package.json` | export `./contracts/entities` |
| `packages/simplycms/tsup.config.ts` | профіль нового субшляху |
| `eslint.config.mjs` | підключення зони ключів |
| `docs/superpowers/specs/2026-08-29-…-design.md` | К3-6: `orders` переїхав у Категорію A |

**Свідомо НЕ чіпаються:** 170 літеральних `queryKey` у `packages/simplycms/src/admin/**`. Сторінки адмінки переписуються в Е1б–Е6 разом із ключами — той самий принцип, що з 27 вставками в Е0. Лінт-зона їх не покриває; покриє, коли теку буде переписано.

---
# Частина 1 — хвости Е0

Чотири знахідки, свідомо відкладені при прийманні Е0 (рішення власника
2026-08-30). Ідуть першими, бо дрібні, незалежні одна від одної і
розчищають ґрунт.

### Task 1: Гранти в шаблоні міграції плагіна

**Files:**
- Modify: `packages/cli/template-plugin/migrations/0001___PLUGIN_TABLE_PREFIX__init.sql`
- Test: `tests/cli-create.test.ts`

**Interfaces:**
- Produces: скаффолджений плагін, чия таблиця доступна `usePluginTable` без ручної доробки.

🔴 Модель безпеки B5″: `app_runtime` **не має прямих грантів** — права
дістає через `SET LOCAL ROLE app_user|app_admin`. Шаблон створює таблицю
з нулем `grant`, тож перший же виклик порту дає `permission denied`.
Референс має рівно два (`plg_faq_items.sql:27,31`). Регресії немає — теку
`migrations/` у шаблоні створив Е0 — але скаффолд видає файл, що
**виглядає завершеним**, і автор плагіна дізнається про проблему в
рантаймі.

- [ ] **Step 1: Написати падаючий тест**

```ts
// у tests/cli-create.test.ts — додати до наявного describe про create plugin
it('міграція шаблону видає гранти обом ролям магазину', () => {
  const sql = readFileSync(
    resolve(
      import.meta.dirname,
      '../packages/cli/template-plugin/migrations/0001___PLUGIN_TABLE_PREFIX__init.sql',
    ),
    'utf8',
  );
  // Без грантів таблиця недоступна: app_runtime прав не має за побудовою
  // (B5″), а порт плагіна ходить під app_user/app_admin.
  expect(sql).toMatch(/grant\s+select\s+on\s+table\s+\S+\s+to\s+app_user/i);
  expect(sql).toMatch(
    /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+\S+\s+to\s+app_admin/i,
  );
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run tests/cli-create.test.ts`
Expected: FAIL — жодного `grant` у шаблоні.

- [ ] **Step 3: Додати гранти**

Дописати в кінець `0001___PLUGIN_TABLE_PREFIX__init.sql`, дзеркалячи
референс FAQ:

```sql
-- Вітрина читає таблицю плагіна під `app_user`.
grant select on table __PLUGIN_TABLE_PREFIX__items to app_user;

-- Адмінка плагіна пише під `app_admin`.
grant select, insert, update, delete on table __PLUGIN_TABLE_PREFIX__items to app_admin;
```

🔴 Набір грантів — рівно той, що в референсі: вітрина читає, адмінка
пише. Ширший набір (наприклад `insert` для `app_user`) був би розширенням
межі довіри §7 і потребував би окремого рішення.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run tests/cli-create.test.ts`
Expected: PASS.

- [ ] **Step 5: Гейти**

Run: `pnpm test && pnpm lint`
Expected: PASS, 0 errors.

- [ ] **Step 6: Коміт**

```bash
git add packages/cli/template-plugin tests/cli-create.test.ts
git commit -m "fix(v2-k3): шаблон міграції плагіна видає гранти обом ролям

Скаффолд створював таблицю з нулем grant, тож перший виклик
usePluginTable давав permission denied: за моделлю B5″ app_runtime прав
не має, вони йдуть через SET LOCAL ROLE. Референс FAQ гранти мав, шаблон
— ні, і файл при цьому виглядав завершеним.

Хвіст Е0, відкладений при прийманні (рішення власника 2026-08-30).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: README міграцій описує чинний механізм

**Files:**
- Modify: `packages/simplycms/migrations/README.md` (рядки ~18-25)
- Modify: `packages/create-simplycms-store/template/supabase/migrations/README.md` (через `template:sync`)

**Interfaces:**
- Produces: документація, що не веде наступного читача шукати неіснуючі конструкції.

🔴 README стверджує: «у файл руками дописано `ALTER COLUMN "id" DROP
DEFAULT` для 40 таблиць». Перевірено — таких входжень у
`0001_init.sql` **нуль**: DEFAULT прибрано інлайново в `CREATE TABLE`, а
джерело правди — `schema.ts`. Абзац навчає шукати 40 неіснуючих ALTER-ів
після регенерації.

- [ ] **Step 1: Переконатись у розходженні**

```bash
grep -c 'ALTER COLUMN "id" DROP DEFAULT' packages/simplycms/migrations/0001_init.sql
grep -c 'PRIMARY KEY NOT NULL' packages/simplycms/migrations/0001_init.sql
```
Expected: `0` і `40` — саме розходження, яке треба описати правдиво.

- [ ] **Step 2: Переписати абзац**

```markdown
🔴 **Контракт id (трек V2-К3, етап Е0) — читати перед регенерацією.**
Таблиці «Категорії A» оголошені як `"id" uuid PRIMARY KEY NOT NULL` —
**без** `DEFAULT gen_random_uuid()`. Це не ручна правка генерату:
джерело — `schema.ts`, де ці колонки не мають `.defaultRandom()`, тож
drizzle-kit відтворює форму сам. Ключ генерує **викликач** (браузер —
`crypto.randomUUID()`, сервер — `randomUUID()`), інакше оптимістичний
рядок клієнтського кеша розійшовся б ключем із серверним.

Руками у згенерований файл дописані лише `COMMENT ON COLUMN` — вони
пояснюють контракт тому, хто дивиться на схему в ізоляції. Склад
Категорії B (де `DEFAULT` лишається) стережуть гейти
`id-defaults.test.ts` і `explicit-ids.test.ts`.
```

- [ ] **Step 3: Синхронізувати копію в шаблоні**

```bash
pnpm template:sync
git diff --stat packages/create-simplycms-store/template/supabase/migrations/README.md
```
Expected: копія оновлена.

- [ ] **Step 4: Гейти**

Run: `pnpm test`
Expected: PASS, зокрема `create-store-template-parity`.

- [ ] **Step 5: Коміт**

```bash
git add packages/simplycms/migrations/README.md packages/create-simplycms-store/template
git commit -m "docs(v2-k3): README міграцій описує чинний механізм id

Стверджував, що для 40 таблиць руками дописано ALTER COLUMN DROP DEFAULT
— таких входжень нуль: форма йде зі schema.ts через drizzle-kit, руками
дописані лише COMMENT ON COLUMN. Абзац навчав шукати неіснуюче.

Хвіст Е0, відкладений при прийманні.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `orders` переходить у Категорію A

**Files:**
- Modify: `packages/simplycms/migrations/0001_init.sql` (`orders.id` + `COMMENT`)
- Modify: `packages/simplycms/src/schema/schema.ts` (`orders.id`)
- Modify: `packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts` (`CATEGORY_B`)
- Modify: `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts` (`ID_FROM_DB`, якщо там є)
- Modify: `docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md` (К3-6)
- Modify: `CLAUDE.md` (розділ «Контракт id»)

**Interfaces:**
- Consumes: інваріант Е0 — `order-create.ts:99` уже передає `id: orderId`.
- Produces: Категорія B звужується до чотирьох таблиць Better Auth.

🔴 **Це зміна рішення спеки, а не виправлення помилки.** Обґрунтування
К3-6 («DEFAULT — страхувальна сітка; сервер ключ усе одно шле явно») було
правильним **до** Task 1 етапу Е0 і застаріло після нього. Перевірено:
єдина вставка в `orders` — `order-create.ts:99`, і вона передає `id`
явно; в адмінці лише `.from('orders')` для читання й `update`. Тобто
сітка нічого не страхує, а лишається fail-silent пасткою рівно в
таблиці, яку адмінка отримає в керування в Е1б–Е6.

- [ ] **Step 1: Довести, що вставка одна і вона з id**

```bash
grep -rn "insert(orders)" --include="*.ts" packages/ src/ scripts/ | grep -v test
grep -n "insert(orders)" -A3 packages/simplycms/src/storefront/loaders/order-create.ts
```
Expected: рівно один сайт, і в ньому `id: orderId`. 🔴 Якщо з'явився
другий шлях без `id` — спершу додати туди ключ, інакше Step 4 покладе
чекаут.

- [ ] **Step 2: Написати падаючий тест**

У `id-defaults.test.ts` прибрати `'orders'` із `CATEGORY_B`:

```ts
/**
 * Категорія B — лише таблиці Better Auth: `generateId:'uuid'` +
 * `supportsUUIDs` драйвера означає, що BA не кладе id в INSERT узагалі
 * (`auth/instance.ts:78-87`), тож зняття DEFAULT поклало б signUp.
 *
 * 🔴 `orders` вийшла звідси в Е1а: її єдина вставка
 * (`order-create.ts:99`) передає ключ явно з Е0, тож DEFAULT перестав
 * бути страхувальною сіткою і став fail-silent пасткою в таблиці, яку
 * адмінка отримує в керування.
 */
const CATEGORY_B = new Set(['users', 'sessions', 'accounts', 'verifications']);
```

- [ ] **Step 3: Запустити — має впасти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts`
Expected: FAIL — `DEFAULT на id у Категорії A: orders (gen_random_uuid())`.

- [ ] **Step 4: Зняти DEFAULT з `orders`**

```sql
-- 0001_init.sql, CREATE TABLE "orders"
	"id" uuid PRIMARY KEY NOT NULL,
```

```sql
-- і COMMENT — замінити текст Категорії B на A
COMMENT ON COLUMN "orders"."id" IS 'Категорія A: client-generated UUID. Ключ шле сервер (order-create), DEFAULT знято в Е1а — сітка перестала страхувати після Е0.';
```

```ts
// schema.ts
export const orders = pgTable("orders", {
	id: uuid().primaryKey().notNull(),
	// …решта без змін
});
```

- [ ] **Step 5: Запустити — має пройти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts`
Expected: PASS, 2/2 (`orders` більше не в B, решта B на місці).

- [ ] **Step 6: Синхронізувати шаблон і оновити доки**

```bash
pnpm template:sync
```

У спеці, К3-6, таблицю Категорії B привести до чотирьох рядків і додати
рядок про перегляд:
`🔴 Ревізія Е1а: orders переведено в Категорію A — після Е0 її вставка передає ключ явно, тож DEFAULT став fail-silent.`

У `CLAUDE.md`, розділ «Контракт id»: «DEFAULT лишили тільки
`users`/`sessions`/`accounts`/`verifications`» — прибрати згадку `orders`
і виправити «40 таблиць» на 41.

- [ ] **Step 7: Живий доказ — чекаут не зламався**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/cart; echo
```
Expected: `200 200`. 🔴 Повний чекаут прожити не обов'язково — Е0 його
вже довів, а тут змінюється лише DDL; але якщо є змога, оформити
замовлення й перевірити `select count(*) from orders` варто.

- [ ] **Step 8: Гейти й коміт**

```bash
pnpm test && pnpm test:schema
git add packages/simplycms/migrations packages/simplycms/src/schema \
        packages/simplycms/test-harness packages/create-simplycms-store/template \
        docs/superpowers/specs CLAUDE.md
git commit -m "fix(v2-k3)!: orders переходить у Категорію A

BREAKING CHANGE: DEFAULT знято з orders.id. Обґрунтування спеки К3-6
(«страхувальна сітка») було правильним ДО Е0 і застаріло після нього:
єдина вставка order-create.ts:99 передає ключ явно, в адмінці лише
читання й update. Сітка нічого не страхувала, а лишалась fail-silent
пасткою в таблиці, яку адмінка отримує в керування в Е1б–Е6.

Категорія B звужена до чотирьох таблиць Better Auth — там делегування
генерації базі конструктивне.

Хвіст Е0, знайдений імплементером і підтверджений при валідації.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Дискавер id звіряє таблицю за значенням

**Files:**
- Modify: `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts:105-118`

**Interfaces:**
- Produces: гейт, що не пропускає аліасовану форму вставки.

🔴 Сьогодні гейт **fail-open**: рядок `if (table === undefined) continue`
тихо пропускає вставку, чиє ім'я не збіглося з експортом схеми. Тобто
`db.insert(ordersTable)` після `import { orders as ordersTable }` не
перевіряється взагалі. Аліасованих форм у коді зараз нуль — але Е1б–Е6
це і є хвилі нових серверних вставок, і така форма впаде `23502` у
рантаймі замість почервоніти в гейті.

- [ ] **Step 1: Написати негативний контроль як тест**

```ts
// у explicit-ids.test.ts, поруч із наявними
it('дискавер бачить аліасовану форму .insert(alias)', () => {
  // Синтетичне джерело: так виглядатиме вставка після
  // `import { orders as ordersTable } from 'simplycms/schema'`.
  const source = [
    "import { orders as ordersTable } from 'simplycms/schema';",
    'async function create(db) {',
    '  await db.insert(ordersTable).values({ userId: null });',
    '}',
  ].join('\n');

  const sites = discoverInsertsInSource(source, 'synthetic.ts');
  expect(
    sites.map((s) => s.table),
    'аліасована вставка мусить бути знайдена, інакше гейт fail-open',
  ).toContain('orders');
});
```

🔴 Це вимагає винести тіло скану у **чисту функцію**
`discoverInsertsInSource(src, file)`, яку `discoverInserts(dir)` кличе
для кожного файлу. Без цього негативний контроль довелось би писати
через тимчасовий файл на диску.

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: FAIL — `ordersTable` немає в мапі експортів, вставку пропущено.

- [ ] **Step 3: Резолвити аліас перед звіркою**

```ts
/**
 * Локальні аліаси Drizzle-таблиць: `import { orders as ordersTable }`.
 * 🔴 Без цього кроку скан був fail-open — незнайоме імʼя тихо
 * пропускалось, тож аліасована вставка не перевірялась узагалі.
 */
function aliasMap(src: string, tables: Map<string, string>): Map<string, string> {
  const resolved = new Map(tables);
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'simplycms\/schema[^']*'/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(src)) !== null) {
    for (const part of im[1].split(',')) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(part);
      if (!m) continue;
      const table = tables.get(m[1]);
      if (table !== undefined) resolved.set(m[2], table);
    }
  }
  return resolved;
}
```

У скані використовувати `aliasMap(src, tables)` замість `tables`.

🔴 Форми, що лишаються поза скану **свідомо**, — задокументувати в
коментарі поруч: `.insert(getTable(name))` (обчислене імʼя),
`.insert(schema[key])` (індексний доступ). Вони не резолвляться
статично; якщо така форма зʼявиться в ядрі — це сигнал додати
рантайм-перевірку, а не розширювати регекс.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
Expected: PASS. 🔴 Кількість знайдених сайтів має **зрости або лишитись**
— якщо впала, резолв щось зламав.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm test:schema
git add packages/simplycms/test-harness
git commit -m "test(v2-k3): дискавер id резолвить аліаси таблиць

Гейт був fail-open: незнайоме імʼя тихо пропускалось, тож
db.insert(ordersTable) після import { orders as ordersTable } не
перевірявся взагалі. Аліасованих форм у коді нуль, але Е1б–Е6 — це
хвилі нових серверних вставок, і така пройшла б повз гейт до 23502 у
рантаймі.

Тіло скану винесено в чисту функцію — інакше негативний контроль
довелося б писати через тимчасовий файл.

Хвіст Е0, знайдений імплементером.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
# Частина 2 — контракт ключів

### Task 5: Реєстр `ENTITY` і фабрика `entityKey`

**Files:**
- Create: `packages/simplycms/src/contracts/entities.ts`
- Create: `packages/simplycms/src/contracts/__tests__/entity-key.test.ts`
- Create: `packages/simplycms/src/schema/__tests__/entity-parity.test.ts`
- Modify: `packages/simplycms/package.json` (export `./contracts/entities`)
- Modify: `packages/simplycms/tsup.config.ts` (профіль)

**Interfaces:**
- Produces:
  - `ENTITY` — `Readonly<Record<string, string>>`, значення = імʼя таблиці в SQL;
  - `entityKey(entity: string)` → `{ all(): readonly [string]; list(): readonly [string,'list']; detail(id: string): readonly [string,'detail',string]; scoped(relation: string, parentId: string): readonly [string,string,string] }`.

🔴 `ENTITY` — **плоскі рядки, не Drizzle-таблиці**. T0 не має рантайм-
залежностей, а `getTableName()` тягнув би `drizzle-orm` у клієнтський
бандл. Звʼязок зі схемою тримає **тест парності** (той самий патерн, що
гранти-як-код + гейт парності привілеїв).

- [ ] **Step 1: Написати падаючий тест форми ключів**

```ts
// packages/simplycms/src/contracts/__tests__/entity-key.test.ts
import { describe, expect, it } from 'vitest';
import { ENTITY, entityKey } from '../entities';

describe('entityKey: єдина форма ключів кешу', () => {
  const k = entityKey(ENTITY.orderStatuses);

  it('сегмент 0 — завжди імʼя таблиці', () => {
    expect(k.all()).toEqual(['order_statuses']);
  });

  it('усі похідні ключі розширюють базовий як ПРЕФІКС', () => {
    // 🔴 Це вимога коректності query-collection, не стиль: TanStack Query
    // знаходить записи колекції префіксним матчем, і ключ, що не
    // розширює базовий, лишає застарілі дані у кеші (спека, Додаток Б-2).
    const base = k.all();
    for (const derived of [k.list(), k.detail('abc'), k.scoped('section', 'x')]) {
      expect(derived.slice(0, base.length)).toEqual(base);
    }
  });

  it('форма кожного ключа стабільна', () => {
    expect(k.list()).toEqual(['order_statuses', 'list']);
    expect(k.detail('abc')).toEqual(['order_statuses', 'detail', 'abc']);
    expect(k.scoped('section', 'x')).toEqual(['order_statuses', 'section', 'x']);
  });

  it('ENTITY не містить дублікатів значень', () => {
    const values = Object.values(ENTITY);
    expect(new Set(values).size).toBe(values.length);
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `pnpm vitest run packages/simplycms/src/contracts/__tests__/entity-key.test.ts`
Expected: FAIL — модуля `../entities` немає.

- [ ] **Step 3: Написати модуль**

```ts
// packages/simplycms/src/contracts/entities.ts
/**
 * Реєстр імен сутностей і фабрика ключів кешу (рішення К3-3).
 *
 * 🔴 Значення — імʼя таблиці в SQL, і воно тут ЄДИНЕ джерело правди для
 * ключа кешу: доти, доки ключ можна написати рядком у місці вжитку, одна
 * сутність неминуче отримує кілька ключів (виміряно: `pickup_points` жила
 * під чотирма — два на вітрині, два в адмінці). Розсинхрон при цьому
 * невидимий, поки обидва шляхи не працюють одночасно.
 *
 * 🔴 Тут ПЛОСКІ РЯДКИ, а не Drizzle-таблиці: тір T0 не має рантайм-
 * залежностей, а `getTableName()` затягнув би `drizzle-orm` у клієнтський
 * бандл. Звʼязок зі схемою тримає тест парності
 * (`schema/__tests__/entity-parity.test.ts`) — той самий патерн, що
 * «гранти як код + гейт парності».
 */
export const ENTITY = {
  banners: 'banners',
  categoryRules: 'category_rules',
  discountConditions: 'discount_conditions',
  discountGroups: 'discount_groups',
  discountTargets: 'discount_targets',
  discounts: 'discounts',
  languages: 'languages',
  media: 'media',
  modificationPropertyValues: 'modification_property_values',
  orderItems: 'order_items',
  orderStatuses: 'order_statuses',
  orders: 'orders',
  pickupPoints: 'pickup_points',
  priceTypes: 'price_types',
  productModifications: 'product_modifications',
  productPrices: 'product_prices',
  productPropertyValues: 'product_property_values',
  productReviews: 'product_reviews',
  products: 'products',
  profiles: 'profiles',
  propertyOptions: 'property_options',
  sectionProperties: 'section_properties',
  sectionPropertyAssignments: 'section_property_assignments',
  sections: 'sections',
  systemSettings: 'system_settings',
  themes: 'themes',
  userCategories: 'user_categories',
} as const satisfies Readonly<Record<string, string>>;

/** Імʼя сутності — значення `ENTITY`, не довільний рядок. */
export type EntityName = (typeof ENTITY)[keyof typeof ENTITY];

/**
 * Ключі кешу однієї сутності. Сегмент 0 завжди `entity`, тож будь-який
 * похідний ключ розширює базовий як префікс — цього вимагає
 * query-collection, інакше оновлення кешу проминає записи.
 */
export function entityKey(entity: EntityName) {
  return {
    all: () => [entity] as const,
    list: () => [entity, 'list'] as const,
    detail: (id: string) => [entity, 'detail', id] as const,
    scoped: (relation: string, parentId: string) =>
      [entity, relation, parentId] as const,
  };
}
```

🔴 Список `ENTITY` — **не повний перелік 45 таблиць**: сюди входять лише
ті, що мають ключ кешу. Таблиці Better Auth і суто серверні
(`plugin_events`, `user_roles`, `shipping_rates` тощо) додаються тоді,
коли зʼявляється їхній кеш. Тест парності це враховує (Step 5).

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/contracts/__tests__/entity-key.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Гейт парності зі схемою**

```ts
// packages/simplycms/src/schema/__tests__/entity-parity.test.ts
import { describe, expect, it } from 'vitest';
import { getTableName, is, Table } from 'drizzle-orm';
import { ENTITY } from 'simplycms/contracts/entities';
import * as schema from '../schema';

/**
 * ENTITY тримає імена таблиць РЯДКАМИ (T0 без рантайм-залежностей), тож
 * звʼязок зі схемою треба доводити машинно: інакше перейменована таблиця
 * лишить у кеші ключ, якого в БД більше немає.
 */
const schemaTables = new Set(
  Object.values(schema)
    .filter((v): v is Table => is(v, Table))
    .map((t) => getTableName(t)),
);

describe('ENTITY ≡ Drizzle-схема', () => {
  it('кожне значення ENTITY існує в схемі', () => {
    const missing = Object.entries(ENTITY)
      .filter(([, table]) => !schemaTables.has(table))
      .map(([key, table]) => `${key} → ${table}`);
    expect(
      missing,
      `ENTITY називає таблиці, яких немає у схемі: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('ключ ENTITY — camelCase від імені таблиці', () => {
    const wrong = Object.entries(ENTITY)
      .filter(([key, table]) => key !== table.replace(/_([a-z])/g, (_, c) => c.toUpperCase()))
      .map(([key, table]) => `${key} ≠ ${table}`);
    expect(wrong, `розбіжність ключа й таблиці: ${wrong.join(', ')}`).toEqual([]);
  });

  it('скан схеми взагалі щось знайшов', () => {
    // Інакше обидва твердження вище зелені через поламаний скан.
    expect(schemaTables.size).toBeGreaterThanOrEqual(40);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/schema/__tests__/entity-parity.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 6: Негативний контроль парності**

```bash
# Тимчасово додати в ENTITY неіснуючу таблицю:
#   fake: 'not_a_table',
pnpm vitest run packages/simplycms/src/schema/__tests__/entity-parity.test.ts
# Expected: FAIL — 'ENTITY називає таблиці, яких немає у схемі: fake → not_a_table'
# Прибрати правку, прогнати знову → PASS
```

🔴 Якщо гейт лишився зеленим — скан зламаний, і етап не закривається.

- [ ] **Step 7: Оголосити субшлях**

У `packages/simplycms/package.json`, `exports`:
```json
"./contracts/entities": "./src/contracts/entities.ts"
```

🔴 Окремий субшлях, **не** через барель `./contracts`: барель обіцяє
«без імпортів react/supabase», а сюди по нього ходитиме і серверний, і
клієнтський код — той самий мотив, що у `./contracts/views`.

У `tsup.config.ts` — додати файл у профіль `contracts` (глоб уже може
його покривати; перевірити `pnpm build:packages` і
`tests/published-exports-parity.test.ts`).

- [ ] **Step 8: Гейти й коміт**

```bash
pnpm test && pnpm lint && pnpm build:packages && pnpm test:packaging
git add packages/simplycms/src/contracts packages/simplycms/src/schema \
        packages/simplycms/package.json packages/simplycms/tsup.config.ts
git commit -m "feat(v2-k3): реєстр ENTITY і фабрика ключів кешу

Імʼя сутності перестає писатись рядком у місці вжитку: одна таблиця
жила під чотирма ключами (pickup_points — два на вітрині, два в
адмінці), і розсинхрон був невидимий, поки обидва шляхи не працюють
разом. Форма ключів єдина, похідні розширюють базовий як префікс —
цього вимагає query-collection, інакше оновлення кешу проминає записи.

ENTITY тримає плоскі рядки (T0 без рантайм-залежностей), звʼязок зі
схемою доводить гейт парності з негативним контролем.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Вітринні ключі на `entityKey` + лінт-зона

**Files:**
- Modify: `packages/simplycms/src/react-query/queries.ts` (`catalogKeys`)
- Modify: `packages/simplycms/src/core/hooks/*.ts` і `src/*-ui/**` — 13 літеральних ключів
- Create: `eslint.query-key-zone.mjs`
- Modify: `eslint.config.mjs`
- Test: `packages/simplycms/src/react-query/__tests__/queries.test.ts` (наявний — оновити)

**Interfaces:**
- Consumes: `ENTITY`, `entityKey` з Task 5.
- Produces: жодного літерального `queryKey` поза текою `admin/`.

🔴 **Адмінка (170 ключів) не чіпається** — той самий принцип, що з 27
вставками в Е0: її сторінки переписуються в Е1б–Е6 разом із ключами, і
правити їх зараз означало б робити роботу двічі. Лінт-зона теку `admin/`
не покриває; покриє, коли її буде переписано.

- [ ] **Step 1: Виписати всі вітринні ключі**

```bash
grep -rn "queryKey: \[" packages/simplycms/src/core packages/simplycms/src/*-ui \
  packages/simplycms/src/react-query packages/simplycms/src/storefront-routes \
  --include="*.ts" --include="*.tsx" | grep -v __tests__
```
Expected: ~13 місць. Виписати кожне з таблицею, до якої воно належить.

- [ ] **Step 2: Оновити наявний тест ключів**

`packages/simplycms/src/react-query/__tests__/queries.test.ts` уже
перевіряє `catalogKeys`. Додати твердження:

```ts
it('усі ключі каталогу починаються з імені сутності', () => {
  expect(catalogKeys.all[0]).toBe(ENTITY.products);
  expect(catalogKeys.sections[0]).toBe(ENTITY.sections);
  expect(catalogKeys.product('x')[0]).toBe(ENTITY.products);
});
```

Run: `pnpm vitest run packages/simplycms/src/react-query/__tests__/queries.test.ts`
Expected: FAIL — зараз `catalogKeys.all` = `['catalog']`.

- [ ] **Step 3: Перевести ключі**

```ts
// react-query/queries.ts
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

const products = entityKey(ENTITY.products);
const sections = entityKey(ENTITY.sections);

/**
 * Ключі каталогу. 🔴 Сегмент 0 — імʼя таблиці з ENTITY, не рядок
 * `'catalog'`: інакше вітрина й адмінка адресують ту саму сутність
 * різними ключами, і мутація в одній не інвалідовує другу.
 */
export const catalogKeys = {
  all: products.all(),
  product: (idOrSlug: string) => products.detail(idOrSlug),
  products: (q: ProductQuery) => [...products.list(), q] as const,
  sectionProducts: (sectionId: string, q?: ProductQuery) =>
    [...products.scoped('section', sectionId), q ?? null] as const,
  sections: sections.list(),
  // …решта за тим самим правилом
};
```

Так само 13 вітринних місць: `['banners', …]` → `entityKey(ENTITY.banners)…`,
`['product-reviews', id]` → `entityKey(ENTITY.productReviews).scoped('product', id)`,
`['active-pickup-points']` / `['pickup-points-count']` →
`entityKey(ENTITY.pickupPoints).list()` з різними суфіксами.

🔴 Два ключі однієї сутності — це нормально, якщо вони **розширюють один
префікс**. Ненормально — коли префікси різні.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/react-query packages/simplycms/src/storefront-routes`
Expected: PASS, зокрема наявний `home-catalog-query-key-collision.test.tsx`.

- [ ] **Step 5: Лінт-зона**

```js
// eslint.query-key-zone.mjs
/**
 * Заборона літерального `queryKey` поза реєстром ENTITY.
 *
 * 🔴 Тека `src/admin/**` під виїмкою: 170 її ключів зникнуть разом зі
 * сторінками в Е1б–Е6 (той самий принцип, що з 27 вставками в Е0).
 * Прибрати виїмку — частина завершення переписування адмінки.
 */
export const queryKeyZone = {
  files: [
    'packages/simplycms/src/core/**/*.{ts,tsx}',
    'packages/simplycms/src/*-ui/**/*.{ts,tsx}',
    'packages/simplycms/src/react-query/**/*.{ts,tsx}',
    'packages/simplycms/src/storefront-routes/**/*.{ts,tsx}',
    'packages/simplycms/src/admin-data/**/*.{ts,tsx}',
  ],
  ignores: ['**/__tests__/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "Property[key.name='queryKey'] > ArrayExpression > Literal[value=/^[a-z]/]",
        message:
          'Літеральний queryKey заборонений: ключ будується entityKey(ENTITY.x) ' +
          'із simplycms/contracts/entities. Інакше та сама сутність отримує ' +
          'різні префікси, і оновлення кешу проминає записи.',
      },
    ],
  },
};
```

Підключити в `eslint.config.mjs` поруч із наявними зонами.

- [ ] **Step 6: Негативний контроль лінта**

```bash
# Тимчасово додати у будь-який файл зони:
#   const q = { queryKey: ['banners'], queryFn: async () => [] };
pnpm lint
# Expected: FAIL — 'Літеральний queryKey заборонений…'
# Прибрати правку → pnpm lint = 0 errors
```

- [ ] **Step 7: Живий доказ вітрини**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/catalog \
  localhost:3141/cart; echo
```
Expected: `200 200 200`. Ключі — клієнтський кеш, тож SSR їх не покаже;
відкрити `/catalog` у браузері й переконатись, що товари й фільтри
працюють після гідрації.

- [ ] **Step 8: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm build
git add packages/simplycms/src eslint.query-key-zone.mjs eslint.config.mjs
git commit -m "feat(v2-k3): вітринні ключі кешу через entityKey + лінт-зона

Одна таблиця жила під різними ключами на вітрині й в адмінці
(pickup_points, product_reviews, banners) — після К3 адмін змінив би
пункт видачі, а вітрина показала б старий. Тепер сегмент 0 будь-якого
ключа — імʼя таблиці з ENTITY, і літеральний queryKey валить лінт.

Тека admin/ під виїмкою: її 170 ключів зникнуть разом зі сторінками в
Е1б–Е6.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---
# Частина 3 — топологія QueryClient

### Task 7: `QueryClient` переїжджає в router context

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `packages/simplycms/src/core/providers/CMSProvider.tsx`
- Modify: `packages/cli/host/src/router.tsx`, `packages/cli/host/src/routes/__root.tsx` (канон)
- Modify: `packages/create-simplycms-store/template/src/**` (через `template:sync`)
- Test: `packages/simplycms/src/core/__tests__/query-client-context.test.tsx`

**Interfaces:**
- Produces: `getRouter()` створює `QueryClient` і кладе його в router context; `CMSProvider` споживає його через наявний проп `customQueryClient`.
- Consumes у Е1б: `loader` роуту дістає `context.queryClient` і кличе `preload()` колекції.

🔴 **Найризикованіша задача етапу** — зачіпає host-файли під каноном
`packages/cli/host/src/` і `template:sync`. Тому вона окремо й остання:
все попереднє вже зелене, і регресію легко локалізувати.

Навіщо: сьогодні `QueryClient` народжується в `CMSProvider` через
`useState(() => new QueryClient(…))`, тобто **всередині React-дерева**.
Колекція TanStack DB потребує `queryClient` у момент створення, а
`preload()` викликається в `loader` роуту — **поза** React. Без переїзду
Е1б не має де взяти клієнт.

- [ ] **Step 1: Написати падаючий тест**

```tsx
// packages/simplycms/src/core/__tests__/query-client-context.test.tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { CMSProvider } from '../providers/CMSProvider';

function Probe({ onClient }: { onClient: (c: QueryClient) => void }) {
  onClient(useQueryClient());
  return null;
}

describe('CMSProvider: клієнт приходить ззовні', () => {
  it('використовує переданий QueryClient, а не створює власний', () => {
    const external = new QueryClient();
    let seen: QueryClient | null = null;

    render(
      <CMSProvider customQueryClient={external}>
        <Probe onClient={(c) => { seen = c; }} />
      </CMSProvider>,
    );

    // 🔴 Саме той самий інстанс: колекції TanStack DB memoізуються по
    // QueryClient, і другий інстанс дав би другий набір колекцій —
    // тобто тихий розсинхрон між loader і компонентом.
    expect(seen).toBe(external);
  });

  it('без переданого клієнта провайдер усе одно працює', () => {
    // Сумісність із тестами й storybook-подібними точками входу.
    let seen: QueryClient | null = null;
    render(
      <CMSProvider>
        <Probe onClient={(c) => { seen = c; }} />
      </CMSProvider>,
    );
    expect(seen).toBeInstanceOf(QueryClient);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/core/__tests__/query-client-context.test.tsx`
Expected: перший кейс може вже проходити (проп існує), другий теж —
🔴 якщо обидва зелені одразу, це нормально: тест фіксує контракт, який
Task 7 не має зламати, а не вводить нову поведінку в `CMSProvider`.

- [ ] **Step 2: Створити клієнт у роутері**

```tsx
// src/router.tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

/**
 * 🔴 `QueryClient` народжується ТУТ, а не в `CMSProvider`.
 *
 * Причина архітектурна: колекції TanStack DB (Е1б) memoізуються по
 * інстансу `QueryClient` і потрібні в `loader` роуту — тобто ПОЗА
 * React-деревом. Клієнт, створений усередині провайдера, там недосяжний.
 *
 * Дефолти ті самі, що були в `CMSProvider`, — переїзд не міняє поведінки
 * кешу, лише місце створення.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    },
  });

  return createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

- [ ] **Step 3: Оголосити контекст у кореневому роуті**

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // …наявні head/component без змін
});
```

І передати клієнт у провайдер (місце монтування не змінюється —
`CMSProvider` лишається там само, всередині `I18nProvider`/`ThemeProvider`):

```tsx
function RootDocument() {
  const { queryClient } = Route.useRouteContext();
  // …
  <CMSProvider customQueryClient={queryClient}>
```

🔴 `createRootRoute` → `createRootRouteWithContext<RouterContext>()` —
зверни увагу на **подвійний виклик**: спершу фабрика з типом, потім
обʼєкт роуту.

- [ ] **Step 4: Гейти типів і збірки**

```bash
pnpm build && pnpm typecheck
```
Expected: PASS. 🔴 `build` іде **перед** `typecheck` — він генерує
`routeTree.gen.ts`, і без нього типи роутів не зійдуться.

- [ ] **Step 5: Синхронізувати канон host-файлів**

Ті самі правки — у канонічні копії, інакше `simplycms update` роздасть
магазинам стару топологію:

```bash
# 1. Перенести зміни в packages/cli/host/src/router.tsx і
#    packages/cli/host/src/routes/__root.tsx (ручна правка — це канон,
#    а не генерат).
# 2. Синхронізувати шаблон скаффолдера:
pnpm template:sync
git diff --stat packages/create-simplycms-store/template/src
```
Expected: `router.tsx` і `__root.tsx` шаблону оновлені.

Run: `pnpm test`
Expected: PASS, зокрема `create-store-template-parity` і
`tests/host-*`-гарди, якщо такі є.

- [ ] **Step 6: Живий доказ — гідрація не зламалась**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
pnpm build && PORT=3141 pnpm start &
curl -s -o /dev/null -w '%{http_code} ' localhost:3141/ localhost:3141/catalog \
  localhost:3141/cart localhost:3141/auth; echo
```
Expected: `200 200 200 200`.

🔴 **Обовʼязково в браузері**: відкрити `/catalog`, перевірити консоль —
нуль `console.error`, товари відрендерені після гідрації. Переїзд
`QueryClient` — саме той клас зміни, що ламається не на SSR, а на
гідрації (два інстанси клієнта → порожній кеш на клієнті).

⚠️ Відомий фон: одноразовий React error #418 на сторінці товару
зафіксований ще в Е0 і до цієї задачі стосунку не має.

- [ ] **Step 7: Повний ланцюг і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
  && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
  && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
git add src packages/cli/host packages/create-simplycms-store/template \
        packages/simplycms/src/core
git commit -m "feat(v2-k3): QueryClient переїжджає в router context

Клієнт народжувався в CMSProvider через useState, тобто всередині
React-дерева. Колекції TanStack DB (Е1б) memoізуються по інстансу
QueryClient і потрібні в loader роуту — поза React, де такий клієнт
недосяжний.

Дефолти кешу не змінені: переїхало місце створення, не поведінка.
Канон host-файлів і шаблон синхронізовані — інакше simplycms update
роздав би магазинам стару топологію.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## DoD етапу Е1а

1. **Повний ланцюг гейтів зелений:**
   ```bash
   pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
     && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
     && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
   ```
   `pnpm lint` = 0 errors, 12 warnings — лінія не зрушена.

2. **Три негативні контролі прогнані вручну:**
   - Task 4 Step 2 — аліасована вставка не знаходиться дискавером до фіксу;
   - Task 5 Step 6 — неіснуюча таблиця в `ENTITY` червонить парність;
   - Task 6 Step 6 — літеральний `queryKey` у зоні валить лінт.

   Без них гейти не доведені, і етап **не закривається**.

3. **`pnpm test:schema`** зелений, і `orders` більше не в Категорії B:
   ```bash
   pnpm vitest run --config vitest.schema.config.ts \
     packages/simplycms/test-harness/pg/__tests__/id-defaults.test.ts
   ```

4. **Живий прогін** із перевіркою **в браузері** (не лише `curl`):
   `/`, `/catalog`, `/cart`, `/auth` → 200; консоль без `console.error`;
   каталог рендериться після гідрації.

5. **`pnpm pilot:pack`** пройдено — доводить, що зміни в host-каноні,
   шаблоні плагіна й `exports` не зламали пакування.

6. **Скаффолджений плагін працює**: `simplycms create plugin probe` →
   у міграції є обидва `grant`.

7. **Доки узгоджені**: спека К3-6 і `CLAUDE.md` називають Категорію B у
   складі чотирьох таблиць; README міграцій описує чинний механізм.

## Що НЕ входить в Е1а

- Жодного рядка TanStack DB: ні колекцій, ні `useLiveQuery`, ні
  залежності `@tanstack/react-db` — усе це Е1б.
- `admin-server`, `defineAdminResource`, `subset.ts` — Е1б.
- 170 літеральних `queryKey` в `src/admin/**` — зникнуть зі сторінками
  в Е1б–Е6.
- Гейти `mutation-cache-sync`, `handler-canon`, `id-mismatch` — вони
  стережуть мутації через колекції, яких тут ще немає.
- Storage-порт — Е2.
- Fail-loud перевірка secure context — Е1б, разом із першою клієнтською
  генерацією `id` в адмінці.

## Точка передачі

Після закриття DoD — повернутись на валідацію з трьома артефактами:
вивід живого прогону (п. 4, включно з консоллю браузера), вивід **усіх
трьох** негативних контролів (п. 2) і `git log --oneline` етапу.

Наступний план — **Е1б: серверний шар і перша колекція**:
`admin-server` (T2) із `defineAdminResource` і `subset.ts`, `admin-data`
(T4) із реєстром колекцій по `WeakMap<QueryClient>`, `order_statuses`
наскрізь — включно з іменованою операцією `setDefault` (у сторінки є
доменний інваріант: `is_default` знімається з інших, і саме він
показує межу «фабрика vs операція»), плюс гейти `mutation-cache-sync`,
`handler-canon`, `id-mismatch` і дві тір-зони.
