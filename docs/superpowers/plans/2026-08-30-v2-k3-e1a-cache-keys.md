# V2-К3 · Етап Е1а: контракт ключів кешу і топологія QueryClient

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити чотири хвости Е0, звести ім'я сутності до єдиного джерела правди (Drizzle-схема) і перенести `QueryClient` у router context — тобто підготувати ґрунт, на який Е1б покладе серверний шар і колекції.

**Architecture:** Ім'я сутності більше не пишеться руками: реєстр `ENTITY` у T0 (плоскі рядки, нуль рантайм-залежностей) під тестом парності з `getTableName()` Drizzle-таблиць, а `entityKey()` будує з нього ключі єдиної форми. Вітринні ключі переводяться на цю фабрику й закриваються лінтом; ключі адмінки лишаються як є — вони зникнуть разом зі сторінками в Е1б–Е6. `QueryClient` переїжджає з `CMSProvider` у `getRouter()` і router context, бо `loader` роуту мусить дістати колекцію ще до рендера.

**Tech Stack:** TanStack Router 1.168 · TanStack Query 5.101 · Drizzle 0.45.2 · TypeScript 5.9 strict · Vitest 4 · ESLint 10

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — рішення К3-3 (ключі), К3-6 (id), К3-9 (розкладка); Додаток Б-2 (вимога префікса)

**Попередній етап:** [Е0 — контракт id](2026-08-29-v2-k3-e0-id-contract.md), прийнятий 2026-08-30 (гілка `claude/v2-k3-admin-server-layer`, HEAD `8fc06a53`). Валідовано незалежними прогонами, включно з обома негативними контролями.

**Обсяг:** перша половина етапу Е1. **TanStack DB тут ще немає** — жодної колекції, `useLiveQuery` чи нової залежності. Друга половина (Е1б: `admin-server`, `defineAdminResource`, `subset.ts`, реєстр колекцій, `order_statuses` наскрізь, гейти `mutation-cache-sync` / `handler-canon` / `id-mismatch`) пишеться після валідації цього.

🔴 **Ревізія 1 (2026-08-30) за зовнішнім аудитом.** Перша редакція мала
блокер і сім major: `ENTITY` пропускав шість таблиць, які вже сьогодні в
кеші вітрини (`user_addresses`, `user_recipients`, `stock_by_pickup_point`,
три `shipping_*`); інвентар називав 13 ключів замість 36 і не бачив
непрямих форм; лінт-зона на `no-restricted-syntax` **мовчки вимкнула б
i18n-детектор** (flat config замінює опції правила); субшлях додавався
лише в dev-`exports` без `publishConfig`; Task 3 не оновлював
Drizzle-снапшот і `.github/instructions`; тест `QueryClient` проходив до
зміни й не доводив топологію; тест грантів був фальшиво-зелений.
Виправлено все; звідси кастомне ESLint-правило замість зони й три форми
ключів замість однієї.

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
| `eslint-rules/query-key-from-entity.mjs` | **Перше кастомне AST-правило репо**: `queryKey` з реєстру (зона `no-restricted-syntax` неможлива — конфлікт із i18n) |
| `tests/router-query-client.test.ts` | Інтеграційний тест топології `QueryClient` (кореневий — імпортує host) |

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
| `src/router.tsx`, `src/routes/__root.tsx` | `QueryClient` у router context (канон `packages/cli/host/` і шаблон оновлює `template:sync`, руками не чіпати) |
| `packages/simplycms/src/core/providers/CMSProvider.tsx` | приймає клієнт із контексту |
| `packages/simplycms/package.json` | `./contracts/entities` в **обидві** мапи: `exports` і `publishConfig.exports` |
| `packages/simplycms/tsup.config.ts` | профіль нового субшляху |
| `eslint.config.mjs` | підключення правила окремим плагін-блоком |
| `packages/simplycms/drizzle/0000_init.sql` + `drizzle/meta/0000_snapshot.json` | регенерація після `orders` (інакше `db:diff` бачить дрейф) |
| `.github/instructions/data-access.instructions.md`, `src/schema/README.md` | 41 таблиця Категорії A, чотири B |
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

🔴 Перевіряти треба **згенеровану** міграцію (у тесті вже є скаффолджений
плагін), а не сирий шаблон, і асертити ТОЧНУ множину грантів — інакше
закоментований `grant` або зайвий `insert` для `app_user` проходять
зеленими. Це security boundary, тут «щось знайшлося» не доказ.

```ts
// у tests/cli-create.test.ts — до наявного describe про create plugin
it('згенерована міграція видає РІВНО два гранти й нічого зайвого', () => {
  // `generatedPluginDir` — тека вже скаффолдженого плагіна з наявного
  // тесту; якщо змінна зветься інакше, узяти чинну.
  const file = readdirSync(join(generatedPluginDir, 'migrations'))[0];
  const raw = readFileSync(join(generatedPluginDir, 'migrations', file), 'utf8');

  // 🔴 Прибрати коментарі: закоментований grant не дає прав, але
  // регексу виглядає як справжній.
  const sql = raw.replace(/--[^\n]*/g, '');

  const grants = [...sql.matchAll(/grant\s+([^;]+?)\s+on\s+table\s+(\S+)\s+to\s+(\w+)/gi)]
    .map((m) => ({
      privileges: m[1].split(',').map((s) => s.trim().toLowerCase()).sort().join(','),
      role: m[3].toLowerCase(),
    }));

  expect(grants).toHaveLength(2);
  expect(grants).toContainEqual({ privileges: 'select', role: 'app_user' });
  expect(grants).toContainEqual({
    privileges: 'delete,insert,select,update',
    role: 'app_admin',
  });

  // Жодних прав рантайм-ролі: вона їх дістає через SET LOCAL ROLE (B5″).
  expect(sql).not.toMatch(/to\s+app_runtime/i);
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
# 🔴 Шукати і Drizzle-, і SQL-форму, і В ТЕСТАХ теж: `grep -v test`
# приховав би дві фікстурні вставки (перша редакція плану через це
# стверджувала «єдина вставка»).
grep -rn "insert(orders)\|insert into public.orders\|from('orders').insert" \
  --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.mjs" \
  packages/ src/ scripts/ supabase/ tests/
```
Expected: **три** сайти, усі з `id`:
- `storefront/loaders/order-create.ts:99` — `id: orderId`;
- `test-harness/pg/__tests__/fixtures/rls-actors.ts:59,63` — обидві через
  `ORDER_COLUMNS`, який починається з `id`.

🔴 Якщо зʼявився шлях без `id` — спершу додати туди ключ, інакше Step 4
покладе чекаут або `test:schema`.

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

- [ ] **Step 6: Оновити Drizzle-артефакти, шаблон і ВЕСЬ канон доків**

🔴 `drizzle/0000_init.sql:153` і `drizzle/meta/0000_snapshot.json` досі
тримають `DEFAULT gen_random_uuid()` для `orders`. Snapshot — база
наступних diff-ів (`src/schema/README.md:3`), тож поки він старий,
`drizzle-kit generate` бачитиме дрейф.

🔴 **`pnpm db:diff` тут НЕ підходить, і це важливо.** Він = `drizzle-kit
generate` + копія **нового** SQL у канон наступним номером
(`scripts/db-diff.mjs:6-9`). Журнал має один запис `0000_init`, тож
generate не перепише baseline — він додасть `0001` у `drizzle/` і ще
один файл у канон. Тобто замість «зняти DEFAULT у baseline» ми дістали б
зайву міграцію в журналі.

**Правильний шлях — точкова правка обох артефактів** (як зробив Е0: три
його коміти торкались `drizzle/`, і там зараз рівно ті самі п'ять
таблиць із DEFAULT, що й у каноні):

```bash
# 1. Зняти DEFAULT для orders у baseline drizzle і в снапшоті:
#    packages/simplycms/drizzle/0000_init.sql       — рядок "id" таблиці orders
#    packages/simplycms/drizzle/meta/0000_snapshot.json — поле default колонки id
# 2. Переконатись, що всюди лишилось рівно ЧОТИРИ таблиці з DEFAULT:
for f in packages/simplycms/migrations/0001_init.sql \
         packages/simplycms/drizzle/0000_init.sql \
         packages/simplycms/drizzle/meta/0000_snapshot.json; do
  echo "$f: $(grep -c gen_random_uuid "$f")"
done
# Expected: 4, 4, 4 — лише users/sessions/accounts/verifications
pnpm template:sync
```

🔴 Доказ відсутності дрейфу — **не** `pnpm db:diff` (він створить файли).
Перевірка: `drizzle-kit generate` у теці пакета має сказати «No schema
changes». Якщо він усе ж генерує міграцію — снапшот і `schema.ts`
розійшлися, і це треба лагодити, а не комітити результат.

🔴 **Доки — чотири джерела, не два.** Крім спеки й `CLAUDE.md` канон
містить:
- `.github/instructions/data-access.instructions.md:68` — обовʼязкова
  інструкція, розділ «Контракт id»;
- `packages/simplycms/src/schema/README.md:14`;
- **назву другого кейса** в `id-defaults.test.ts` («інакше ляже auth і
  створення замовлень» — після зміни там лише auth);
- пояснювальний коментар `explicit-ids.test.ts:25`.

Скрізь: «40 таблиць Категорії A» → **41**, Категорія B → чотири таблиці
Better Auth.

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
  shippingMethods: 'shipping_methods',
  shippingRates: 'shipping_rates',
  shippingZones: 'shipping_zones',
  stockByPickupPoint: 'stock_by_pickup_point',
  systemSettings: 'system_settings',
  themes: 'themes',
  userAddresses: 'user_addresses',
  userCategories: 'user_categories',
  userRecipients: 'user_recipients',
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

/**
 * Ключ, що обслуговує кілька таблиць одним запитом.
 *
 * 🔴 Не всі кеші однотабличні, і зводити їх силою до `entityKey` було б
 * регресією: `shipping-directory` одним походом читає `shipping_methods`,
 * `shipping_zones` і `shipping_rates` (`storefront/loaders/shipping.ts:81,107,136`),
 * а `stock-info` — `stock_by_pickup_point`, `product_modifications` і
 * `products`. Розбити їх на три ключі означало б три раундтрипи замість
 * одного.
 *
 * Тому агрегат лишається одним ключем, але **називає свої залежності
 * явно** — інакше мутація в `shipping_rates` не мала б як його
 * інвалідувати. `deps` тут не декорація: саме звідси Е1б візьме список
 * ключів для інвалідації.
 */
export function aggregateKey(
  name: string,
  deps: readonly EntityName[],
): { key: readonly [string]; deps: readonly EntityName[] } {
  return { key: [name] as const, deps };
}

/** Агрегати вітрини — єдине місце, де вони оголошені. */
export const AGGREGATE = {
  shippingDirectory: aggregateKey('shipping-directory', [
    ENTITY.shippingMethods,
    ENTITY.shippingZones,
    ENTITY.shippingRates,
  ]),
  stockInfo: aggregateKey('stock-info', [
    ENTITY.stockByPickupPoint,
    ENTITY.productModifications,
    ENTITY.products,
  ]),
} as const;

/**
 * Ключі, що НЕ належать жодній таблиці: сесійний і похідний стан.
 *
 * 🔴 Іменований allowlist, а не виняток у лінті: `['auth','is-admin', id]`
 * (`core/hooks/useAuth.tsx:45`) описує обчислене право, а не рядок БД, і
 * прив'язувати його до таблиці `user_roles` було б брехнею — воно
 * перераховується із сесії, а не читається звідти.
 */
export const SESSION_KEY = {
  isAdmin: (userId: string | null) => ['auth', 'is-admin', userId] as const,
} as const;
```

🔴 Список `ENTITY` — **не повний перелік 45 таблиць**: сюди входять лише
ті, що мають ключ кешу сьогодні (33 імені). Таблиці Better Auth і суто
серверні (`plugin_events`, `user_roles`, `service_requests`) додаються
тоді, коли зʼявиться їхній кеш.

🔴 Склад звірений з **фактичним інвентарем кешів**, а не складений з
голови: перша редакція плану мала 27 імен і пропускала `user_addresses`,
`user_recipients`, `stock_by_pickup_point` і три `shipping_*` — усі вони
вже сьогодні в клієнтському кеші вітрини. Крок 1 Task 6 вимагає звірити
інвентар ще раз перед реалізацією: якщо в коді зʼявився новий кеш, його
таблиця має бути тут.

- [ ] **Step 4: Запустити — має пройти**

Run: `pnpm vitest run packages/simplycms/src/contracts/__tests__/entity-key.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Гейт парності зі схемою**

```ts
// packages/simplycms/src/schema/__tests__/entity-parity.test.ts
import { describe, expect, it } from 'vitest';
import { getTableName, is, Table } from 'drizzle-orm';
import { AGGREGATE, ENTITY } from 'simplycms/contracts/entities';
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

  it('кожна залежність агрегату існує в ENTITY', () => {
    // 🔴 `deps` агрегату — не декорація: з них Е1б будує інвалідацію.
    // Залежність поза ENTITY зробила б її мовчазно неповною.
    const known = new Set(Object.values(ENTITY));
    for (const [name, agg] of Object.entries(AGGREGATE)) {
      for (const dep of agg.deps) {
        expect(known.has(dep), `${name}: залежність ${dep} поза ENTITY`).toBe(true);
      }
    }
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/schema/__tests__/entity-parity.test.ts`
Expected: PASS, 4/4.

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

🔴 **Мап дві, і обидві обовʼязкові.** `audit-exports` окремо вимагає
запис у `publishConfig.exports` (86 входів сьогодні); без нього
`pnpm test` червоніє, а tarball не експортує модуль.

`packages/simplycms/package.json`, `exports` (dev):
```json
"./contracts/entities": "./src/contracts/entities.ts"
```

той самий файл, `publishConfig.exports` (tarball):
```json
"./contracts/entities": {
  "types": "./dist/contracts/entities.d.ts",
  "import": "./dist/contracts/entities.js"
}
```

Окремий субшлях, **не** через барель `./contracts`: барель обіцяє «без
імпортів react/supabase», а сюди ходить і серверний, і клієнтський код —
той самий мотив, що у `./contracts/views`.

У `tsup.config.ts` — додати файл до чинного профілю `contracts`
(`tsup.config.ts:104`). 🔴 Глоби профілю матчать `index.ts` і
`*/index.ts`, тож `entities.ts` під них **не підпадає** — потрібен явний
патерн `src/contracts/entities.ts`, інакше субшлях не збереться в `dist`
і `test:packaging` червонітиме. Окремий профіль не потрібен.

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
- Create: `eslint-rules/query-key-from-entity.mjs`
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
# 🔴 Шукати ВСІ входження `queryKey`, а не лише `queryKey: [` — інакше
# непрямі форми лишаться невидимими (перша редакція плану саме так і
# нарахувала «~13» замість фактичних 36).
grep -rn "queryKey" packages/simplycms/src/core packages/simplycms/src/*-ui \
  packages/simplycms/src/react-query packages/simplycms/src/storefront-routes \
  --include="*.ts" --include="*.tsx" | grep -v __tests__ | tee /tmp/keys.txt | wc -l
```
Expected: **36** входжень (виміряно 2026-08-30). Виписати кожне з
таблицею або агрегатом, до якого воно належить.

🔴 Три форми, які легко проґавити — вони є в коді вже сьогодні:

| Форма | Приклад | Де |
|---|---|---|
| константа-масив | `const ADDRESS_BOOK_KEY = ['address-book']` → `queryKey: ADDRESS_BOOK_KEY` | `core/hooks/useAddressBook.ts:28,43` |
| умовний вибір | `queryKey: sectionId === undefined ? ['all-products'] : ['section-products', sectionId]` | `storefront-routes/pages/catalog/useCatalogProductsQuery.ts:23` |
| агрегат кількох таблиць | `queryKey: ['shipping-directory']` (читає 3 таблиці) | `core/hooks/useShippingDirectory.ts:37` |

Перші дві переводяться на `entityKey`, третя — на `AGGREGATE`.

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

- [ ] **Step 5: Кастомне ESLint-правило (НЕ зона `no-restricted-syntax`)**

🔴 **Зона `no-restricted-syntax` тут неможлива, і це не стиль.** Flat
config **замінює** опції правила, а не зливає. Репозиторій сам про це
попереджає (`eslint.config.mjs:241-243`): тір-зони свідомо зроблені на
`no-restricted-imports`, «тож перетину опцій з i18n/env-зонами
`no-restricted-syntax` немає». Моя зона накрила б `storefront-routes/**`
і `*-ui/**`, які вже під i18n-зоною (`I18N_MIGRATED_FILES`,
`eslint.config.mjs:203`) — і залежно від порядку конфігів **мовчки
вимкнувся б або i18n-детектор, або цей**. Обидва наслідки катастрофічні
й непомітні.

Тому — власне правило з окремим імʼям. Це перше кастомне AST-правило в
репозиторії; Е1б додасть до нього `mutation-cache-sync`.

```js
// eslint-rules/query-key-from-entity.mjs
/**
 * `queryKey` будується з реєстру ENTITY, а не пишеться літералом.
 *
 * 🔴 Окреме правило, а не селектор у `no-restricted-syntax`: flat config
 * замінює опції правила цілком, тож зона поверх i18n-зони мовчки
 * вимкнула б одну з двох (`eslint.config.mjs:241-243`).
 *
 * Ловить три форми, яких евристичний селектор не бачив:
 *   queryKey: ['banners']                 — прямий літерал
 *   queryKey: ADDRESS_BOOK_KEY            — константа-масив у модулі
 *   queryKey: cond ? ['a'] : ['b', id]    — умовний вибір
 * Значення має лише ПЕРШИЙ сегмент — він визначає префікс.
 */
const MESSAGE =
  'queryKey мусить починатися з ENTITY/AGGREGATE/SESSION_KEY ' +
  '(simplycms/contracts/entities). Літеральний перший сегмент дає ' +
  'сутності різні префікси, і оновлення кешу проминає записи.';

/** `x as const` / `(x)` — розгорнути до самого виразу. */
function unwrap(node) {
  let n = node;
  while (n && (n.type === 'TSAsExpression' || n.type === 'TSTypeAssertion')) {
    n = n.expression;
  }
  return n;
}

/** Гілки умовного виразу — інакше `cond ? ['a'] : ['b']` пройде повз. */
function branches(node) {
  if (node?.type === 'ConditionalExpression') {
    return [...branches(node.consequent), ...branches(node.alternate)];
  }
  return [node];
}

/** Масив, чий ПЕРШИЙ елемент — рядковий літерал. */
const startsWithLiteral = (node) =>
  node?.type === 'ArrayExpression' &&
  node.elements[0]?.type === 'Literal' &&
  typeof node.elements[0].value === 'string';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'queryKey з реєстру ENTITY' },
    schema: [],
    messages: { literalKey: MESSAGE },
  },
  create(context) {
    // Константи-масиви модуля: `const ADDRESS_BOOK_KEY = ['address-book']`.
    const literalConsts = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          startsWithLiteral(unwrap(node.init))
        ) {
          literalConsts.add(node.id.name);
        }
      },
      Property(node) {
        const key = node.key;
        const name =
          key.type === 'Identifier'
            ? key.name
            : key.type === 'Literal'
              ? key.value
              : null;
        if (name !== 'queryKey') return;

        for (const candidate of branches(node.value)) {
          const value = unwrap(candidate);
          const offends =
            startsWithLiteral(value) ||
            (value?.type === 'Identifier' && literalConsts.has(value.name));
          if (offends) {
            context.report({ node: candidate, messageId: 'literalKey' });
            return;
          }
        }
      },
    };
  },
};
```

Підключення в `eslint.config.mjs` — окремим блоком, як плагін:

```js
import queryKeyFromEntity from './eslint-rules/query-key-from-entity.mjs';

{
  files: [
    'packages/simplycms/src/core/**/*.{ts,tsx}',
    'packages/simplycms/src/*-ui/**/*.{ts,tsx}',
    'packages/simplycms/src/react-query/**/*.{ts,tsx}',
    'packages/simplycms/src/storefront-routes/**/*.{ts,tsx}',
  ],
  ignores: ['**/__tests__/**'],
  plugins: {
    simplycms: { rules: { 'query-key-from-entity': queryKeyFromEntity } },
  },
  rules: { 'simplycms/query-key-from-entity': 'error' },
},
```

🔴 Теки `src/admin/**` у списку немає — її 170 ключів зникнуть зі
сторінками в Е1б–Е6. Додати її туди — крок завершення переписування
адмінки, і саме тоді DoD К3-3 закриється повністю.

- [ ] **Step 6: Контролі правила — по одному на кожну форму**

```bash
# НЕГАТИВНІ (правило МУСИТЬ впасти) — по черзі додати у файл зони:
#   1) const q = { queryKey: ['banners'], queryFn: async () => [] };
#   2) const K = ['address-book'] as const;
#      const q = { queryKey: K, queryFn: async () => [] };
#   3) const q = { queryKey: x ? ['all-products'] : ['section-products', x],
#                  queryFn: async () => [] };
pnpm lint   # кожного разу Expected: FAIL із повідомленням правила

# ПОЗИТИВНІ (правило НЕ сміє чіпати):
#   4) const q = { queryKey: [...products.list(), filters], queryFn: … };
#   5) const q = { queryKey: [ENTITY.products, 'list'], queryFn: … };
#   6) const q = { queryKey: AGGREGATE.shippingDirectory.key, queryFn: … };
#   7) const q = { queryKey: SESSION_KEY.isAdmin(userId), queryFn: … };
pnpm lint   # Expected: 0 errors

# Прибрати всі правки → pnpm lint = 0 errors / 12 warnings
```

🔴 Позитивні контролі не менш обовʼязкові за негативні: правило, що
банить правильний код, обходитимуть коментарями, і воно перестане щось
означати. Перша редакція цього плану мала саме таку ваду — селектор
`Literal[value=/^[a-z]/]` валив легітимне `[ENTITY.products, 'list']`.


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
git add packages/simplycms/src eslint-rules/query-key-from-entity.mjs eslint.config.mjs
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
- Generated: `packages/cli/host/src/**` і `packages/create-simplycms-store/template/src/**` — обидві цілі оновлює `pnpm template:sync`, руками не редагувати
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
Expected: **обидва кейси зелені одразу** — `CMSProvider` уже приймає
`customQueryClient`.

🔴 Саме тому цього тесту НЕ досить: він доводить контракт провайдера, а
не нову топологію. Реалізація з **двома різними** клієнтами (один у
роутері, другий створений провайдером) пройшла б його. Тому додається
другий тест — інтеграційний:

```tsx
// tests/router-query-client.test.ts
//
// 🔴 Кореневий тест, не в пакеті ядра: він імпортує HOST-файл
// (`src/router.tsx`), а пакет `simplycms` у host лізти не повинен —
// це зворотний напрям залежності. Прецедент — `tests/admin-guard-path.test.ts`.
import { describe, expect, it } from 'vitest';
import { getRouter } from '../src/router';

describe('топологія: клієнт роутера — той самий, що в дереві', () => {
  it('router.options.context.queryClient існує', () => {
    const router = getRouter();
    // 🔴 Без цього `loader` не має де взяти колекцію (Е1б).
    expect(router.options.context?.queryClient).toBeDefined();
  });

  it('два виклики getRouter дають РІЗНІ клієнти', () => {
    // Кожен запит на сервері має власний кеш: спільний інстанс протік би
    // між користувачами.
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient,
    );
  });
});
```

🔴 Тотожність «клієнт роутера === `useQueryClient()` у дереві»
доводиться живим прогоном (Step 6): якщо вони різні, каталог після
гідрації показує порожній кеш і перезапитує все. Юніт-тестом це
відтворити важко — root-провайдер тягне I18n, Theme і Engine; тому тут
чесніше покластися на браузерну перевірку, ніж імітувати дерево.

**Негативний контроль:** тимчасово прибрати `customQueryClient={queryClient}`
у `__root.tsx` → у браузері на `/catalog` мають зʼявитися повторні
запити після гідрації (мережева панель) при зелених юнітах. Повернути.

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
function RootComponent() {
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

🔴 **Руками канон НЕ правиться.** `src/router.tsx` і
`src/routes/__root.tsx` входять у `SYNCED_FILES`
(`scripts/sync-create-store-template.mjs:47,50`), а скрипт оновлює
ОБИДВІ цілі з монорепо — і шаблон, і `packages/cli/host/`, причому
канон він перед копіюванням зносить (`rmSync(hostRoot, …)`, рядок ~96).
Тобто ручна правка канону не просто зайва — вона буде знищена.

```bash
pnpm template:sync
git diff --stat packages/cli/host packages/create-simplycms-store/template/src
```
Expected: у дифі — `router.tsx` і `__root.tsx` в **обох** цілях.

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

2. **Контролі прогнані вручну — негативні І позитивні:**
   - Task 4 Step 2 — аліасована вставка не знаходиться дискавером до фіксу;
   - Task 5 Step 6 — неіснуюча таблиця в `ENTITY` червонить парність;
   - Task 6 Step 6 — **три негативні** форми (літерал, константа-масив,
     умовний вибір) валять правило, і **чотири позитивні** (spread,
     `[ENTITY.x, 'list']`, `AGGREGATE.*.key`, `SESSION_KEY.*`) не чіпає;
   - Task 7 Step 6 — прибраний `customQueryClient` дає повторні запити
     після гідрації.

   Без них гейти не доведені, і етап **не закривається**. Позитивні
   контролі обовʼязкові нарівні з негативними: правило, що банить
   правильний код, обходитимуть коментарями.

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

7. **Доки узгоджені в усіх чотирьох джерелах**: спека К3-6, `CLAUDE.md`,
   `.github/instructions/data-access.instructions.md`,
   `src/schema/README.md` — 41 таблиця Категорії A, чотири Better Auth;
   README міграцій описує чинний механізм; назви кейсів у
   `id-defaults.test.ts` не згадують замовлення.

8. **`pnpm db:diff` не показує дрейфу** — Drizzle-снапшот регенеровано
   разом зі зняттям DEFAULT з `orders`.

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
