# Реєстр операцій і HTTP API

Канон запису адмінки й зовнішнього API (Мультимовність М1, рядки І14, І24–І29 матриці майстра).
Контракт дроту (конверт, статуси, `kind`, токени, ідемпотентність) зафіксовано в майстер-плані
§3.3 ([`2026-10-15-multilingual-wave-master.md`](../superpowers/plans/2026-10-15-multilingual-wave-master.md));
тут — як його тримає код і які гейти не дають розійтися.

🔴 **Інваріант:** запис адмінки й API — лише операції реєстру. serverFn — тонка обгортка, що
делегує операцію; HTTP `/api/v1` — той самий виконавець. Логіки в обгортці немає, `withActor` і
ядра `*In` поза `run` операції не викликаються (І25).

---

## 1. Операція

- **Опис** — `defineOperation` (`simplycms/operations`, T2, server-only): `id` формату
  `OPERATION_ID_FORMAT` (`languages.add`, `products.saveDescription`; некоректний id — помилка при
  завантаженні модуля, а не 404 на проді), `permission` (ключ `AUTHZ_MATRIX`), вхідна й вихідна
  zod-схеми, прапорці `idempotent: 'create'`, `versioned`, `sessionOnly`, `transport`, і `run(ctx,
  input)`. `ctx` — суб'єкт ЯВНИЙ (не з запиту), `CoreActor`, транзакція `db`, `afterCommit` (хвіст
  після коміту, лише добирає вже записаний у транзакції намір — напр. стирання файлів).
- **Реєстр** — `CORE_OPERATIONS` і `getOperation` (`admin-server/impl/operations-registry.ts`).
  Реєстр живе в `admin-server`, бо саме він визначає операції; `simplycms/operations` про нього не
  знає (цикл тірів), тому роут HTTP передає `getOperation` адаптеру.
- **Нова операція** = файл операції + рядок у `CORE_OPERATIONS` + тонка serverFn-обгортка в
  `admin-server/index.ts`. Паритет доводить тест (§5).

## 2. Виконавець

`executeOperation(def, raw, subject, opts)` — ЄДИНИЙ виконавець для serverFn і HTTP:

1. право й scopes токена — `requireOperation` (403 `forbidden`);
2. валідація входу — `ValidationError` лише з білого списку (`path` + `code`, без сирого вводу);
3. транзакція `withActor` під роллю суб'єкта (`dbRoleForSubject`); за `opts.idempotency` ключ
   резервується ПЕРШОЮ дією тієї самої транзакції (§4);
4. `run`, потім вихід розбирається схемою `output` ВСЕРЕДИНІ транзакції (`encodeOutput`):
   невідповідність відкочує зміну, а зайві поля відсікаються однаково для обох транспортів;
5. конфлікти БД → `toAdminConflict` (`simplycms/db`, обмеження розпізнаються за ІМЕНЕМ —
   `isForeignKeyViolation`, `isCheckViolation`); хвости `afterCommit` — лише після коміту.

Статусу відповіді виконавець НЕ ставить (його кличуть і поза HTTP-запитом: тести, сід). Порядок
перевірок агрегата (І14): версія, ПОТІМ хеш джерела — спільний хелпер `assertVersionThenHash`
під `FOR NO KEY UPDATE` кореня агрегата (`lockAggregateRoots`); тест
`operations/__tests__/check-order.test.ts`.

## 3. Транспорти

- **serverFn** — `invokeFromServerFn(op, data)` (`simplycms/operations/server`): суб'єкт з cookie
  (`subjectFromCookie`), статус доменної помилки — з тієї самої карти `toProblem`, що й HTTP, тож
  транспорти не розходяться. Обгортка має рівно форму
  `createServerFn({ method }).validator(passThrough).handler(({ data }) => invokeFromServerFn(op, data))`.
- **HTTP** — роут `routes/storefront/api/v1/$op.tsx` → `handleApiRequest(request, op, getOperation)`.
  Порядок: 405 (не `POST`, `Allow: POST`) → 401 → 404 `unknown_operation` (після 401: перелік
  операцій анонімові не розкривається) → 403 (`sessionOnly` з Bearer; права) → 415 (не
  `application/json`) → 400 → 412/409. `If-Match: "v<n>"` ↔ `expectedVersion` (операція без
  `expectedVersion` заголовок не приймає — 400, а не тихе ігнорування); відповідь
  версіонованої операції несе `ETag`. Прапорець `transport: 'multipart'` зарезервовано: у М1 таких
  операцій немає, адаптер приймає лише JSON.
- **OpenAPI 3.1** — `buildOpenApi` з реєстру (детермінований, порядок за `id`), роут
  `GET /api/v1/openapi.json` (`handleOpenApiRequest`): валідний Bearer АБО сесія з `admin.access`;
  знімок ядра — `packages/simplycms/api/openapi.core.json` (`pnpm api:snapshot`, тест
  `openapi-snapshot.test.ts`). Дати на дроті — `wireDate` (кодек ISO-рядок ↔ `Date`).

## 4. Токени, ідемпотентність, помилки

- **Токени** (`api_tokens`, `service_accounts`): `scms_<prefix>_<secret>`, у БД лише sha256 усього
  рядка (`hashToken`, пошук за повним хешем — час відмови не залежить від префікса).
  `authenticateRequest`: якщо `Authorization` є, cookie ігнорується назавжди (битий Bearer не падає
  на сесію). Права = роль ∩ scopes; відкликаний, прострочений токен чи забанений власник → 401;
  `last_used_at` — не частіше разу на хвилину. Токен випускається лише собі чи сервісному запису;
  операції `api-tokens.*`/`service-accounts.create` — `sessionOnly` (витеклий Bearer не розмножує
  себе). Тест — `api-tokens.test.ts`, `operations/__tests__/http-auth.test.ts` (І27).
- **Ідемпотентність** (`idempotency_keys`, механізм К5): `reserveIdempotencyKey` —
  `INSERT … ON CONFLICT DO NOTHING RETURNING` першою дією транзакції команди під
  `IDEMPOTENCY_LOCK_TIMEOUT_MS`; дубль чекає на PK (після коміту — replay збереженого, після
  відкату — виконується сам), інший відбиток тіла (`fingerprintOf`) → 422, перевищення
  очікування → 409 `idempotency_in_flight`. Відповідь 2xx дописує `storeIdempotentResponse` перед
  комітом; не-2xx не зберігається (ключ не «витрачено»). Область — `subjectKeyOf` (`token:<id>` для
  Bearer, `user:<uuid>` для cookie). Протухлі (`IDEMPOTENCY_TTL_HOURS`) прибираються порцією
  `IDEMPOTENCY_PRUNE_BATCH` зі `SKIP LOCKED`. Тест — `idempotency.test.ts` (І28, Review Focus 3).
- **problem+json** (RFC 9457): ЄДИНА карта «помилка → (status, kind)» — `toProblem`; таблиця
  статусів — `PROBLEM_STATUS`, заголовки — стабільні англійські. Невідома помилка — 500 `internal`
  без `message` і стека (текст драйвера містить імена таблиць і роль; І29,
  `operations/__tests__/http-problem.test.ts`). `errors` — лише для 400, без сирого вводу.

## 5. Гейти

| Гейт | Що тримає |
|---|---|
| `admin-server/impl/__tests__/registry-parity.test.ts` | І24: кожна операція реєстру має serverFn-обгортку й доступна через HTTP; кожна обгортка посилається на операцію; усі операції токенів — `sessionOnly` |
| `eslint-rules/thin-server-fn.mjs` (`simplycms-ops/thin-server-fn`) | І25: обгортка рівно тонкої форми; `invokeFromServerFn`/`passThrough` — лише з `simplycms/operations/server` |
| `eslint-rules/no-core-outside-operation.mjs` (`simplycms-ops/no-core-outside-operation`) | І25: `withActor`, `runAdmin`, `runAdminTransactions`, `*In` — лише в `run` операції; зона — роути, `src/admin`, вітринні серверні модулі, файли serverFn |
| `eslint-rules/server-fn-top-level.mjs` | `createServerFn` лише топ-рівневим `const`; реекспорт `createServerFn` заборонено і специфікатором, і оголошенням (`export const csf = createServerFn`, `export default …`); трекер бачить аліаси (імпорт, namespace, оголошення, присвоєння) |
| `eslint-rules/legacy-admin-server-fns.json` + `tests/eslint-rules/legacy-ratchet.test.ts` | перелік serverFn, ще не перенесених на реєстр (М3 його знесе), лише скорочується |
| `admin-server/impl/__tests__/user-accessible-operations.test.ts` | які операції доступні покупцю (роль `user`) |

Легасі-перелік (serverFn адмін-зони без операції) переноситься на реєстр у М3; до того на ці
обгортки діють старі межі `runAdmin` ([`data-layer.md`](./data-layer.md) §10).
