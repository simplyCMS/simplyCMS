# Перепроєктування Е1б: доказова база амендменту спеки К3 (2026-08-31)

> Доказова база **ревізії 2026-08-31** спеки
> [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md)
> (К3-4′, К3-9′, К3-13, К3-14). Всі твердження нижче верифіковані читанням
> коду — компілятора, бібліотеки або репо; жодне не взяте з документації
> на віру. Рішення власника (4/4 підтверджені 2026-08-31) — у спеці;
> тут — факти, на яких вони стоять, і повна мапа знахідок двох аудитів.

## 1. Джерела

1. **Аудит плану Е1б сесією-оркестратором** (Opus → Fable, цей чат):
   6 блокерів Б1–Б6, прогалини П1–П8, дрібніші М1–М9/С1–С12.
2. **Аудит Codex** (`gpt-5.6-sol`, reasoning high, read-only sandbox,
   HEAD `87c0eb41`): вердикт REJECT, 6 блокерів + ~12 major. Сирий
   транскрипт — scratchpad сесії `admin-server-layer`
   (`codex-e1b-audit.txt`, фінальний звіт з рядка 17173; артефакт
   тимчасовий, ключові знахідки перенесені сюди).
3. **Особиста верифікація** коду `@tanstack/start-plugin-core@1.167.35`
   (обидва аудити перехресно перевірені один одним — розбіжностей нуль).
4. **Офіційні скіли TanStack DB** з npm-tarball-ів (`@tanstack/db@0.8.6`,
   `@tanstack/react-db@0.3.6`, `@tanstack/query-db-collection@1.2.11`) —
   підключені симлінками `.claude/skills/tanstack-*`.
5. Чотири паралельні дослідження (sonnet): клієнтський бандл/схеми,
   authz/серіалізація помилок, сценарії deps-гейта, інвентар
   `OrderStatuses.tsx`.

## 2. Факти компілятора Start (фундамент К3-4′ і К3-9′)

Джерело: `@tanstack/start-plugin-core/dist/esm/start-compiler/`.

- `handleCreateServerFn.js:104` — `createServerFn must be assigned to a
  variable!`; `:106` — лише простий Identifier (деструктуризація
  заборонена). Форма «фабрика повертає `{ list: createServerFn(...) }`»
  нереалізовна.
- 🔴 Гірше за падіння: `compiler.js` (`areAllKindsTopLevelOnly` →
  fast-path) для файлу, де детектовано ЛИШЕ serverFn, сканує **тільки
  топ-рівень** `ast.program.body`. Виклик усередині фабрики не впав би,
  а **мовчки лишився нетрансформованим** — живий серверний граф поїхав
  би в клієнтський бандл. Звідси ESLint-гейт «`createServerFn` лише в
  топ-рівневому `VariableDeclarator`» — постійний запобіжник обох режимів.
- Клієнтське середовище: `.inputValidator(schema)` **вирізається**
  (`stripMethodCall`) — схема валідатора не їде в бандл; handler-аргумент
  замінюється на `createClientRpc(id)`, і якщо handler — Identifier, його
  binding видаляється явно (`binding.path.remove()`); після трансформації
  запускається `deadCodeElimination` (`compiler.js:516`) — осиротілі
  імпорти чистяться компілятором, не удачею tree-shake.
- Provider-файл (`?tss-serverfn-split`): module-level код виконується,
  всі не-serverFn експорти знімаються (`safeRemoveExports`) — фабрика на
  топ-рівні server-only модуля легальна.
- Кандидати валідуються резолюцією кореня ланцюга до реального імпорту
  `createServerFn` — метод `.handler(...)` на власних обʼєктах хибно не
  спрацьовує.

## 3. Факти бібліотеки TanStack DB (фундамент К3-9′ п.3)

- `schema` у `queryCollectionOptions` — **опційна** (перевантаження
  `schema?: never` + `select`); валідує **лише** оптимістичні
  insert/update (`collection/mutations.js:158-186`); дані `queryFn` не
  валідуються взагалі (нуль згадок у `sync.js`/`state.js`). Тип рядка
  задається явним generic `createCollection<T>`.
- Обидва адаптери несуть `@tanstack/db` **точним піном** у власних
  `dependencies` (`react-db@0.3.6` і `query-db-collection@1.2.11` →
  `db@0.8.6`): peer-ів у ядра ДВА, розсинхрон пінів = два інстанси
  `@tanstack/db` у дереві (підписки одна одну не бачать) → гейт «рівно
  один інстанс».
- `transactions.js`: rollback автоматичний; `isPersisted.promise`
  reject-иться оригінальним `Error` — канал для тостів помилок.
- `useLiveQuery` 0.3.6: бажана форма — обʼєкт `{ query: (q) => … }`;
  dependency-масиви — legacy з warn до 1.0.
- `safeRandomUUID` експортується з `@tanstack/db` — знімає застереження
  К3-6 про `crypto.randomUUID()` поза secure context.
- Вага клієнтського drizzle (виміряно esbuild): `drizzle-orm/pg-core`
  71 KB (Node-депсів немає, але `schema.ts` — module-level side effects,
  одна таблиця тягне всі ~50); `drizzle-zod` жорстко на `zod/v4` classic.
  У репо 57 імпортів `simplycms/schema` — усі серверні; Gate C вже
  містить `/drizzle-orm/` у `SERVER_PAYLOAD` (`gate-c.mjs:41`) — drizzle
  в клієнті заборонений чинним гейтом.

## 4. Факти authz і серіалізації помилок (фундамент К3-13)

- `requireOperation(subject, op): AuthScope` існує (`auth/authz.ts:110-128`)
  з докблоком, чому повертати scope обовʼязково; `dbRoleForSubject` —
  готова, протестована, **ніде не підключена**. Жоден чинний serverFn не
  кличе `requireOperation` і не ловить `AuthzError` — «мапити в 403» був
  задекларованим, але не реалізованим контрактом.
- `server-functions-handler.js:179-199`: кинутий Error → статус
  `getResponse().status ?? 500`; отже 403 = `setResponseStatus(403)` **до**
  `throw`. Кинутий `Response` повертається as-is, але клієнтський fetcher
  (`serverFnFetcher.js:128-190`) резолвить його json-тіло як **успіх** —
  кидати Response заборонено.
- seroval: кастомний підклас Error десеріалізується як голий `Error` з
  накладеними властивостями — `instanceof AuthzError` на клієнті `false`,
  `error.name === 'AuthzError'` і `error.operation` зберігаються.
- Вкладений `withActor` усередині відкритої транзакції = другий
  `pool.connect()` — self-deadlock при вичерпаному пулі; порядок
  «сесія → requireOperation → withActor» обовʼязковий.

## 5. Факти домену (фундамент К3-14 і нової редакції плану)

- `idx_price_types_single_default` (`0001_init.sql:725`) — чинний
  прецедент часткового unique-індексу; 7 інших `is_default`-таблиць без
  захисту, а інваріант тримали два нетранзакційні запити з браузера
  (`OrderStatuses.tsx:87-92,119-123`; те саме в `PriceTypeEdit.tsx:96-103`).
- `OrderStatuses.tsx` — 537 рядків: create з `sort_order = max+1`,
  reorder — swap двома запитами без транзакції (унікальний для цієї
  сторінки), delete дефолтного блокує лише UI-`disabled`, 8 i18n-ключів
  у `toast.*` (лінт їх не бачить за побудовою — «лінт доводить i18n» у
  старому плані було хибним твердженням).
- **Неповні `deps` у прийнятому Е1а (два, не один):** `pickup_points`
  читають і `loadShippingDirectory` (`shipping.ts:70`), і `loadStockInfo`
  (`stock-info.ts:72-75`, innerJoin) — в `AGGREGATE.shippingDirectory.deps`
  і `.stockInfo.deps` його немає. Рантайм-гейт повноти deps окупився ще
  до написання.
- Сценарії deps-гейта: серверFn-обгортки в pg-харнесі не викликаються
  (конвенція репо; `getRequest()` без ALS падає — `price-type.ts:35`,
  `discounts.ts:47`); мінімальні набори викликів внутрішніх лоадерів по
  всіх 7 агрегатах з гілками, фікстурами і uuid демо-сіду — зафіксовані
  в новій редакції плану Е1б. `expect(seen.size).toBeGreaterThan(0)` — у
  кожному кейсі (fail-open захист). `afterAll`: `closeDbPool()` першим.

## 6. Мапа знахідок → рішення

| Знахідки (об'єднано обидва аудити) | Закрито |
|---|---|
| createServerFn-as-property (Codex Б-К1), fast-path-тиша, схеми в клієнтському барелі (Б2/Б-К2), нетестовність без Start (Б-К5), batch лише `[0]`, exhaustiveness через `as never` | **К3-4′** + ESLint-гейт top-level |
| `schema: rowSchema` валить оптимістичний insert (Б5), generic-типізація, Gate C маркер `admin-server`, tsup-профіль | **К3-9′** + правки плану |
| `assertAllowed`-дублікат із втратою scope (Б3), вкладений `withActor` (Б4), `AuthzError` → 500 (П8) | **К3-13** |
| `isDefault` у `writable` (Б6), delete дефолтного лише в UI, reorder без транзакції | **К3-14** + іменовані операції |
| deps-harness непрацездатний (Б-К4), fail-open контроль спая (П2), неповні `shippingDirectory`/`stockInfo`.deps | нова редакція Task 1 |
| тір-зона без винятків на власні імпорти (Б1) | зона `admin-server` T2 + `resolveRequestGrant` в `auth` (виняток `['db','auth']` не потрібен ширше) |
| peer-трійка, drizzle-zod (М7/Q6), RouterContext-субшлях (Q7) | **К3-10′** (2 peer + гейт одного інстанса; drizzle-zod у deps ядра; тип через наявний `simplycms/runtime`) |
| зони правил не дістають нових тек (П4/П5), handler-canon без реалізації (П3), реєстр винятків К3-2, i18n-зона | нова редакція плану, розділ гейтів |

## 7. Розкладка модулів (канон для Е1б–Е6)

```
admin-server/resources/<entity>.ts   server-only: defineAdminResource →
                                     операції + drizzle-zod-схеми
admin-server/operations/<name>.ts    server-only: іменовані операції з
                                     інваріантами (setDefault, reorder,
                                     removeOrderStatus…)
admin-server/<entity>.ts             ЛИШЕ топ-рівневі serverFn-const:
                                     .inputValidator(схема).handler(ops.х)
admin-data/collections/<entity>.ts   клієнт: колекція БЕЗ schema, тип —
                                     type-only з simplycms/schema/types,
                                     queryKey — entityKey(ENTITY.х)
admin/features|pages                 UI: useLiveQuery({query}) + мутації
                                     колекції; помилки — isPersisted.catch
```

tsup: `admin-server` — окремий профіль `splitting: false` (прецеденти:
`plugin-sdk/server`, `db`); Gate C: `SERVER_PAYLOAD` += server-only граф
`admin-server`, окремий stub-маркер (чинний `SERVER_FN_STUB` форму
`dist/admin-server/` не матчить).
