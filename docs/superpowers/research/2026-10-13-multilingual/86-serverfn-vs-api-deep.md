# 86. Серверні функції TanStack Start проти API: механіка, межі, рекомендація

Дата: 2026-10-14. Репо: `claude/k3-e8-live-npm` (4ed3794a), у ньому нічого не змінювалось.
Версії з `node_modules` репо: `@tanstack/react-start` 1.168.60, `start-client-core` 1.170.34,
`start-server-core` 1.169.39, `start-plugin-core` 1.171.49, `router-core` 1.171.34, `seroval` 1.6.8,
`zod` 4.6.5, `better-auth` 1.7.7.

Скорочення шляхів (усі в `node_modules/.pnpm/…/node_modules/@tanstack/`):
- **PLUG** = `start-plugin-core/dist/esm/` (компілятор, збірка);
- **CC** = `start-client-core/dist/esm/` (клієнтський рантайм і спільний код);
- **SC** = `start-server-core/dist/esm/` (серверний обробник).

Позначки: **[КОД]** прочитано в коді; **[ЕКСП]** перевірено запуском (скрипти в scratchpad, у репо нічого не писав);
**[ДОК]** офіційна документація; **[ВИСНОВОК]** логічно випливає з коду, але живим прогоном не перевірено.

---

## 0. Коротко

Серверну функцію **можна** викликати ззовні: це звичайний HTTP-запит. Але все, що робить її викликом,
складається з **внутрішніх деталей збірки й бібліотеки**, які не обіцяють стабільності:

- адреса — хеш від шляху файлу й імені змінної;
- тіло — формат seroval, а не JSON;
- помилки — серіалізовані об'єкти всередині тіла, статус ставить наш код вручну;
- автентифікація — лише cookie сесії.

Тож чесне формулювання таке: **«серверна функція — це внутрішній дріт між нашим браузерним кодом і нашим
сервером, а не контракт для чужих програм»**. Формулювання «неможливо викликати ззовні» нечесне.

Власник має рацію в головному: **перевикористовується майже все** — бізнес-логіка, Zod-схеми й авторизація.
Не перевикористовується лише транспорт (сам `createServerFn`). Для зовнішніх потрібен другий, тонкий і
документований транспорт поверх тих самих операцій.

---

## 1. Як фізично працює `createServerFn` (версія репо)

### 1.1. Компілятор переписує код по-різному для трьох середовищ [КОД]

`PLUG/start-compiler/handleCreateServerFn.js`:

- **Шаблони** (рядки 17-19):
  - `createServerRpc(meta, fn)` — у серверному «провайдер»-модулі (файл із суфіксом `?tss-serverfn-split`);
  - `createClientRpc(id)` — у браузерному бандлі;
  - `createSsrRpc(id)` — у SSR-бандлі.
- **Браузерний бандл** (рядки 140, 165): тіло `handler` **вирізається**, на його місце ставиться
  `createClientRpc("<id>")`. Валідатор теж прибирається (`stripMethodCall`). У браузері лишаються тільки id і код запиту.
- **Обмеження за побудовою** (рядки 121-125): `createServerFn` мусить бути присвоєний простій змінній.
  Ім'я змінної стає частиною ідентифікатора: `${ім'я}_createServerFn_handler`. Звідси наше правило «лише
  топ-рівневий `const`» і гейт `server-fn-top-level`. Цикл чи фабрика, що генерує serverFn з реєстру, не працює:
  компілятор їх просто не побачить.
- **SSR** (`SC/createSsrRpc.js`): `createSsrRpc(id)` кличе `getServerFnById(id, {origin:'server'})` **у тому
  самому процесі, без HTTP**. Лоадер вітрини, що кличе serverFn під час SSR, мережу не використовує.

### 1.2. Ідентифікатор: хеш шляху файлу й імені змінної [КОД] + [ЕКСП]

`PLUG/start-compiler/compiler.js:280-313`:

- **dev:** `base64url(JSON.stringify({file, export}))`, тобто інший id, ніж у проді.
- **build:**
  - `sha256("<шлях файлу відносно root>--<ім'я>_createServerFn_handler")`;
  - якщо задано `serverFns.generateFunctionId`, береться результат цієї функції;
  - при колізії додається суфікс `_1`, `_2`…

Перевірка на реальній збірці репо (`dist/server/assets/*`):

```
id: "f3483ae6…2050f6", name: "acceptOwnerInvite",
filename: "packages/simplycms/src/storefront-routes/server/invite.ts"
```

`node -e 'sha256("packages/simplycms/src/storefront-routes/server/invite.ts--acceptOwnerInvite_createServerFn_handler")'`
→ `f3483ae6ab517e394d8411c6a8ff0f744a4258a5eb9bdb31ec95aa866b2050f6`. **Збіг байт у байт** (так само для
`submitProductReview`).

**Що це означає для магазину [ВИСНОВОК].** Магазин ставиться лише через pnpm (`create-simplycms-store/src/steps.mjs:36-44`).
Vite за замовчуванням резолвить симлінки в реальний шлях, а у шаблоні `preserveSymlinks` не задано. Отже шлях
serverFn ядра в магазині має вигляд `node_modules/.pnpm/simplycms@<версія>_<хеш peer>/node_modules/simplycms/dist/admin-server/index.js`.
**Версія пакета входить у хеш**: кожне оновлення платформи міняє всі адреси. Живою збіркою магазину я це
не перевіряв, бо зібраного магазину на машині немає. Але навіть без цього адреса зміниться, якщо:
- перейменувати змінну;
- перенести функцію в інший файл;
- змінити розкладку `dist`.

Проєкт уже визнає це: `scripts/live-smoke/csrf.mjs:18` пише «ідентифікатори хешовані збіркою, вгадувати їх не можна»
і бере адреси з трафіку браузера.

**Чи можна задати власну стабільну адресу:**
- **База шляху:** `serverFns.base` (дефолт `/_serverFn`, `PLUG/schema.js:164`).
- **Id:** `serverFns.generateFunctionId({filename, functionName})`. Документація: «this customization is experimental
  and subject to change» [ДОК]. Вхід функції — той самий шлях файлу й ім'я, тож стабільність на нас.
- **Ручний `id` на функції:** PR TanStack/router#7693 «Add stable IDs for server functions» **відкритий, не змерджений**
  (перевірено `gh api`), у 1.168.60 його немає. У `ServerFnBaseOptions` (`CC/createServerFn.d.ts:76-85`) опцій
  url/path/id немає.

Висновок: людську стабільну адресу можна змайструвати лише експериментальним хуком, і формат тіла все одно
лишиться внутрішнім (див. 1.3-1.4).

### 1.3. Сам HTTP-запит [КОД]

`CC/client-rpc/createClientRpc.js`, `CC/client-rpc/serverFnFetcher.js`:

| Що | Як |
|---|---|
| URL | `process.env.TSS_SERVER_FN_BASE + id`. База інлайниться під час збірки, у рантаймі такої змінної немає (`src/server.ts`, коментар до `SERVER_FN_BASE`) |
| Метод | **GET за замовчуванням** (`CC/createServerFn.js:10`). У нас записи явно `{ method: 'POST' }` |
| GET | `?payload=<seroval-JSON>` у query (`serverFnFetcher.js:78-84`); стеля 1 МБ (`SC/server-functions-handler.js:65`) |
| POST | тіло = seroval-JSON від `{data, context}`, `content-type: application/json` (рядок 90); `FormData` для файлів |
| Заголовки | `x-tsr-serverFn: true` (рядок 76); `accept: application/x-tss-framed, application/x-ndjson, application/json` |
| Cookie | звичайний same-origin `fetch`, тож cookie сесії браузер додає сам; сервер читає `getRequest().headers` |
| Метод не збігся | 405 з `Allow` (`SC/server-functions-handler.js:34-37`) |

### 1.4. Формат тіла: seroval, а не JSON [ЕКСП]

Той самий `toJSONAsync`, яким клієнт кодує `{ data: { id, name:'Товар', price:100, updatedAt: Date } }`, дає:

```
{"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":["id","name","price","updatedAt"],
 "v":[{"t":1,"s":"a1b2"},{"t":1,"s":"Товар"},{"t":0,"s":100},{"t":5,"i":2,"s":"2026-10-14T10:00:00.000Z"}]},"o":0}]},"o":0},"f":127,"m":[]}
```

- `t` — внутрішні коди типів seroval (`SerovalNodeType`, `seroval/dist/index.d.ts:28`); `5` означає Date.
- Перевага для **нашого** браузера: Date, Map, Set, BigInt, посилання й потоки переживають мережу без втрат.
- **Звичайний JSON сервер не приймає.** `fromJSON({data:{id:'a1'}})` → `SerovalDeserializationError: Seroval Error (step: 3)` [ЕКСП].
  Сервер декодує тіло саме так (`SC/server-functions-handler.js:73`).

**Відповідь** (`SC/server-functions-handler.js:80-88, 122-190`):
- заголовок `x-tss-serialized: true`;
- тіло — `application/json` (той самий seroval) або `application/x-tss-framed; v=1`, бінарні кадри для потоків (`CC/constants.js`).

**Помилка** — не HTTP-статус, а об'єкт у тілі [ЕКСП]:

```
{"t":10,…"k":["result","error","context"],"v":[{"t":2,"s":1},{"t":13,…"m":"Конфлікт","p":{"k":["name","stack"],…
```

Як помилка проходить шлях:
1. Ланцюг middleware ловить виняток обробника і кладе його в `error` (`CC/createServerFn.js:138-143`).
2. Сервер серіалізує `{result, error, context}`.
3. HTTP-статус береться з контексту відповіді `getResponse().status` (`SC/server-functions-handler.js:184`).

Тому в нас статус **ставиться вручну до throw**:
- `setResponseStatus(409/400)` у `admin-server/impl/run.ts:58-59`;
- 403 у `auth/authz-request.ts:52`;
- 400 у `impl/validation.ts:26`.

Без цього статус не буде 4xx. За читанням коду це 200 (`getResponseStatus` → `res.status || 200`, `SC/request-response.js:143`),
живим запитом це не перевіряв.

Ще дві особливості:
- Наші доменні помилки йдуть через **власний плагін seroval** `domainErrorAdapter` (`src/start.ts`,
  `runtime/domain-error-adapter.ts`), а непередбачені маскуються (`maskedErrorAdapter`). Зовнішній клієнт мусив би
  розбирати і їх.
- Помилка Zod-валідатора Start — це `new Error(JSON.stringify(issues))` (`CC/createServerFn.js:171-173`), рядок замість
  структури. Тому в нас `adminInput(...)` замість `.validator(schema)` (`impl/validation.ts:51-60`).

`notFound` → 404 JSON (`server-functions-handler.js:304-312`). `redirect` → `Response`, який клієнт перетворює на
навігацію (`serverFnFetcher.js:169`).

### 1.5. CSRF [КОД]

Наш `csrfMiddleware` (`packages/simplycms/src/runtime/csrf.ts`) обгортає `createCsrfMiddleware`
(`CC/createCsrfMiddleware.js:20-34`). Порядок перевірки: `Sec-Fetch-Site` = `same-origin` → `Origin` = origin запиту →
`Referer`. Якщо жодного з цих заголовків немає, результат 403 (рядок 18).

Для **не-браузерного** клієнта (1С, CLI) це означає:
- без заголовків — 403;
- з власноруч виставленим `Origin: https://<магазин>` — **пропускає**.

CSRF захищає браузер від чужих сайтів. Бар'єром проти програми, що свідомо ходить у магазин, він не є: таким
бар'єром може бути лише автентифікація.

### 1.6. Middleware: два різні механізми [КОД]

| | request middleware | function middleware |
|---|---|---|
| Де задається | `createStart({ requestMiddleware })`, `createMiddleware()` (тип за замовчуванням `request`) | `createStart({ functionMiddleware })`, `.middleware([...])` на serverFn, `createMiddleware({type:'function'})` |
| Коли виконується | **на кожен запит**: SSR, server routes, `/_serverFn` (`SC/createStartHandler.js:286-347`) | лише для serverFn (`CC/createServerFn.js:89-152`); має **клієнтську** половину (у браузері) і серверну |
| У нас | `csrfMiddleware`, `bodyLimitMiddleware`, `adminRequestGuard` | `maskUnexpectedErrors` |
| Для API | працює і для server route, тобто CSRF, ліміт тіла й заголовки безпеки отримаємо безкоштовно | на server route **не діє**: маскування помилок для API треба робити в адаптері |

Нюанс: `context` із тіла клієнта зливається з серверним (`SC/server-functions-handler.js:69,76`), причому
серверний ключ перемагає. Зовнішній клієнт може надіслати довільний `context`, тож довіряти йому не можна (ми й не довіряємо).

### 1.7. Як визначається «хто кличе» [КОД]

`auth/authz-request.ts:34`: `readSessionSubject(getRequest().headers)` → `getAuth().api.getSession({headers})`
(`auth/session.ts:48-61`), далі ролі з `user_roles`. **Суб'єкт береться лише з cookie Better Auth.** Токена API не існує.
`better-auth` 1.7.7 має плагін `bearer`, але він передає той самий **сесійний** токен у заголовку, і
довгоживучим ключем інтеграції не є. Плагін `api-key` у залежностях репо не знайшов, деталей не перевіряв.

---

## 2. Що з цього заважає зовнішньому клієнту

Зовнішні клієнти: 1С власника на іншому сервері, CLI, MCP-агент, сторонні інтеграції.

| Вимога зовнішнього клієнта | serverFn | Оцінка |
|---|---|---|
| Стабільна адреса між релізами | хеш шляху й імені; у магазині, ймовірно, ще й версії пакета (1.2); у dev інші id | **крихко**: кожен реліз ламає клієнта мовчки. Хук `generateFunctionId` — experimental |
| Простий формат (JSON) | seroval; простий JSON відхиляється [ЕКСП] | **можливо, але погано**: 1С мусила б реалізувати кодек seroval і наші плагіни. Формат ще рухається: PR #8302 додає опцію `serverFns.transport` (відкритий) |
| Документація / OpenAPI | немає; маніфест функцій — внутрішній віртуальний модуль (`PLUG/start-compiler/server-fn-resolver-module.js`) | **неможливо штатно** |
| Токен замість cookie | лише cookie | **можливо, але погано**: 1С може залогінитись через `/api/auth`, тримати cookie, підробляти `Origin`. Сесія протухає, інтеграція прив'язана до людського акаунта, токена з обмеженими правами нема |
| Версіонування контракту | немає: semver платформи стосується TypeScript-API, не дроту | **неможливо штатно** |
| Коди помилок | статус ставимо вручну; тіло — seroval-об'єкт Error; валідація Start — рядок | **крихко** |
| Ідемпотентність, ліміти частоти | немає | **не відмінність**: на server route їх теж треба писати самим |
| CORS | serverFn same-origin за задумом [ДОК] | **для 1С/CLI/MCP-сервера неважливо**: CORS — механізм браузера, сервер-сервер його не відчуває. Важливо лише для чужого браузерного JS |

**Чи можна сказати «серверну функцію не можна викликати ззовні»? Ні, це неправда.** Правдиво так: «технічно
можна, але адреса й формат — деталі реалізації, які TanStack і наша збірка міняють без попередження; контракту для
зовнішніх немає, і документація TanStack прямо каже: зовнішнім — server routes» [ДОК: «Server functions are meant to be
called by your TanStack Start application… If you need an endpoint that can be called from outside your Start app, use
server routes instead»].

---

## 3. Що перевикористовується повністю і як виглядає «одна операція — два входи»

### 3.1. Шари, що вже є (без HTTP)

| Шар | Де | Залежить від транспорту? |
|---|---|---|
| Zod-схеми входу | `buildResourceSchemas` → `insertSchema/updateSchema/removeSchema/subsetSchema` (`impl/resource.ts:45-52`), іменовані `*Input` | ні |
| Операція | `productsOps.update({data})` (`impl/resource-write-ops.ts:119-122`) — звичайна async-функція | **так, опосередковано**: `parseAdminInput` ставить 400, `runAdmin` бере суб'єкта з cookie і ставить 409/400 |
| Ядра в транзакції викликача | `insertIn/updateIn/removeIn` (`resource-write-ops.ts:133-147`), `CoreActor` (`impl/core-actor.ts:13`) | ні |
| Склейка authz → роль БД → транзакція → мапінг конфліктів | `runAdminTransactions` (`impl/run.ts:35-62`) | **так**: `requireGrant` + `setResponseStatus` |
| Права | `requireOperation(subject, operation)` (`auth/authz.ts`) | ні: чиста функція від суб'єкта |
| serverFn-обгортка | `admin-server/index.ts:218-220`: `createServerFn({method:'POST'}).validator(adminInput(productsOps.updateSchema)).handler(productsOps.update)` | так, і це нормально: це адаптер |

У `admin-server/index.ts` 125 `createServerFn` (усього в ядрі — 190). Кожна обгортка займає три рядки й уже нічого
не робить, крім прив'язки до транспорту.

### 3.2. Що змінити, щоб суб'єкт міг прийти з токена

Дві прив'язки до транспорту живуть **всередині** операції. Їх треба винести на межу.

**(1) Звідки суб'єкт.** `authz-request.ts` розділити так:

```ts
// чисте, без getRequest():
export function grantFor(subject: AuthzSubject, op: Operation): RequestGrant {
  return { subject, scope: requireOperation(subject, op) };      // кидає AuthzError
}
// адаптер serverFn (cookie):
export async function subjectFromCookie(): Promise<AuthzSubject> {
  return (await readSessionSubject(getRequest().headers)) ?? GUEST;
}
// адаптер HTTP API (токен): Authorization: Bearer sk_… → хеш → таблиця api_tokens → AuthzSubject
export async function subjectFromToken(h: Headers): Promise<AuthzSubject | null> { … }
```

Суб'єкт треба доставити в `runAdminTransactions`, не міняючи сигнатур 125 операцій. Для цього є два шляхи:
- **явний параметр**: `runAdmin(operation, fn)` → `runAdmin(subjectSource, operation, fn)`;
- **запитовий контекст**, який ставить адаптер: `AsyncLocalStorage` з одним сеттером на межі транспорту.

Явний параметр чесніший, але потребує правки всіх викликів. Контекст дешевший, і його легко зробити fail-closed:
нема суб'єкта — `AuthzError`. **Ролі й надалі читаються з `user_roles` на кожен запит** (інваріант `session.ts:10-14`);
токен несе лише userId або ідентичність сервісного акаунта плюс звуження прав.

**(2) Хто ставить статус.** `setResponseStatus` прибрати з `run.ts:58-59`, `authz-request.ts:52`, `validation.ts:26`.
Операція лише кидає доменну помилку (`AdminConflictError`, `ValidationError`, `AuthzError`), а статус ставить адаптер:
- **serverFn:** function middleware `mapDomainErrorStatus`, що робить `setResponseStatus` у catch навколо `next()`,
  як нинішній `maskUnexpectedErrors`;
- **HTTP:** `catch` → `application/problem+json` (RFC 9457) з тим самим `kind`, що бачить адмінка.

Ядра (`*In`) вже живуть поза запитом (С-10), тож для них нічого не змінюється.

### 3.3. Одна операція — два входи (ескіз, не код до впровадження)

```ts
// impl/operations/products.ts — ЄДИНЕ визначення
export const productsUpdate = defineOperation({
  name: 'products.update',            // стабільне публічне ім'я = частина URL і semver-контракту
  permission: 'catalog.write',
  input: productsOps.updateSchema,    // та сама Zod-схема
  output: productRowWire,             // див. 3.4 про дати
  run: (input, ctx) => productsOps.update({ data: input }),   // тіло вже існує
});

// admin-server/index.ts — адаптер №1, лишається топ-рівневим const (вимога компілятора, 1.1)
export const updateProducts = createServerFn({ method: 'POST' })
  .validator(adminInput(productsUpdate.input))
  .handler(({ data }) => invoke(productsUpdate, data, subjectFromCookie));

// routes/storefront/api/v1/$.tsx — адаптер №2, ОДИН на всі операції
export const Route = createFileRoute('/api/v1/$')({
  server: { handlers: {
    POST: ({ request, params }) => httpInvoke(registry, params._splat, request), // токен → суб'єкт → invoke → JSON/problem+json
    ANY: () => new Response(null, { status: 405, headers: { Allow: 'POST' } }),
  } },
});
```

Що дублюється:
- **На операцію:** лише рядок реєстру (ім'я, право, схеми) і тримісна serverFn-обгортка, яка вже існує.
  Обгортку не можна згенерувати циклом (1.1), тож паритет «кожна операція реєстру має serverFn і навпаки» стереже тест.
- **HTTP-код на операцію:** нуль. Один catch-all роут диспетчеризує за іменем.
- **Один раз:** автентифікація токеном, мапінг помилок, маскування непередбачених помилок для API (function middleware
  тут не діє, 1.6), OpenAPI-генератор, політика CSRF для `/api/v1`.

Політика CSRF: Bearer-запит пропускати без перевірки Origin (cookie там не використовується); cookie-запит на
`/api/v1` перевіряти й надалі, інакше це діра. Префікс у `CSRF_EXEMPT_PREFIXES` цілком додавати не можна.

### 3.4. Підводний камінь: дати [ЕКСП]

`z.toJSONSchema` на реальних схемах (`buildResourceSchemas(products, …)`):
- `updateSchema` та `insertSchema` — **OK**;
- `rowSchema` — **`Date cannot be represented in JSON Schema`**.

Через serverFn Date їде як Date (seroval). Через JSON це рядок. На HTTP-межі потрібна явна дротова схема виходу:
ISO-рядок (`z.iso.datetime()` або `z.codec` у Zod 4). Правило `AGENTS.md` «Date у застосунку, рядок на межі
виводу» цьому відповідає: межа тепер ще й HTTP. Це робота **один раз на тип колонки**, а не на операцію: генератор
`columnsToZod` уже знає типи колонок.

---

## 4. Варіант «лише server routes, і адмінка теж їсть власний корм»

| | serverFn для адмінки (як зараз) + HTTP API для зовнішніх | лише HTTP API, адмінка теж через нього |
|---|---|---|
| Типобезпека клієнта | наскрізна, безкоштовна: імпорт `updateProducts` дає типи входу й виходу | досяжна без кодогенерації (той самий монорепо): `call<'products.update'>(input)` з типами з реєстру. Треба написати клієнт (~100-200 рядків, оцінка) |
| Дати, Map, потоки | seroval везе як є | лише JSON: дати через кодек на клієнті (парс виходу Zod-схемою) |
| TanStack Query / DB (`admin-data`) | `queryFn: listProducts(...)`, `persistenceHandlers({update: updateProducts})` | **так само просто**: колекціям байдуже, яка async-функція всередині. Заміна локальна в `admin-data/collections/*` |
| Помилки в UI | `domainErrorAdapter` (seroval-плагін, обхід UPSTREAM:START-2) | problem+json → той самий `kind`/i18n-ключ; обхід START-2 для адмінки стає непотрібним |
| CSRF | `csrfMiddleware` + same-origin | те саме для cookie-запитів адмінки (заголовки браузер ставить сам) |
| SSR | адмінка client-only, не потрібен | не потрібен. **Вітрина** лишається на serverFn: SSR-лоадери кличуть їх у процесі без HTTP (`createSsrRpc`) |
| Гарантія повноти API | ризик: фіча, зроблена лише в адмінці, «забуває» API. Лікується тестом паритету реєстру | **за побудовою**: усе, що вміє адмінка, вміє API |
| Обсяг змін | малий: реєстр + адаптер + токени | більший: ще й клієнт адмінки, 125 обгорток зникають, переписати `admin-data` (~35 колекцій) і хуки |
| Залежність від TanStack | адмінка на внутрішньому протоколі Start (наприклад, зміна кодеку в #8302 — їхня турбота) | адмінка від протоколу Start не залежить |
| Розмір бандла | seroval і кодек Start і так у бандлі вітрини | не виміряв |

Оцінка: «власний корм» архітектурно чистий і дає гарантію повноти. Але сьогодні це дорожча міграція без нової
цінності для власника. Цінність перевикористання — **спільне визначення операції**, а не спільний дріт.
Компроміс, що дає ту саму гарантію: контрактний тест проганяє **кожну** операцію реєстру через HTTP-адаптер (і через
serverFn) на тестовій БД. Перехід адмінки на HTTP пізніше лишається локальною заміною в `admin-data`, бо колекціям
транспорт байдужий.

---

## 5. Роль Zod — простими словами

- **Що Zod робить уже зараз.** Це «митниця» на вході кожної операції. Він перевіряє, що прийшло саме те, що
  дозволено: поля, типи, довжини, формат slug. Він же відкидає зайве, наприклад readonly-поля
  (`resource-write-ops.ts:115-122`). Тому однаково захищено і адмінку, і будь-який інший вхід.
- **У кожному варіанті Zod той самий.** serverFn, HTTP-роут, CLI, MCP — лише різні двері до однієї митниці.
  Схеми пишуться **один раз** і живуть біля операції, а не біля дверей. Інтуїція власника тут правильна.
- **Звідки питання «чи підтримує бібліотека X Zod 4».** Zod 4 (у нас 4.6.5) змінив внутрішню будову схем. Бібліотеки,
  що «зазирають усередину» схеми, а не лише кличуть перевірку, без підтримки 4-ї версії просто не розуміють наших схем.
  Найчастіше це генератори OpenAPI. Приклади зі звіту 85:
  - `ts-rest` вимагає Zod 3;
  - корінь `@orpc/zod` імпортує `zod/v3`, а для Zod 4 є окремий субшлях `@orpc/zod/zod4`;
  - `@hono/zod-openapi` вимагає Zod 4.

  Бібліотеки, що лише валідують через стандарт Standard Schema, працюють з обома версіями. Сам Start саме такий:
  `"~standard" in validator`, `CC/createServerFn.js:171`.
- **OpenAPI і MCP з тих самих схем.** Zod 4 сам уміє `z.toJSONSchema(schema)` [ЕКСП: працює на наших схемах входу].
  JSON Schema — це мова, якою описуються і параметри OpenAPI 3.1, і `inputSchema` інструментів MCP. Отже з однієї
  Zod-схеми випливають:
  1. перевірка на вході;
  2. документація для 1С;
  3. опис інструменту для ШІ-агента.

  Стороння бібліотека для цього не обов'язкова, і питання сумісності з Zod 4 зникає. Єдина ручна робота — дротова
  форма дат (3.4).

---

## 6. Рекомендація

**Командний шар В1: один реєстр операцій поверх наявних `defineAdminResource`/`runAdmin`, два тонкі транспорти.
Упевненість ~75 %** (у звіті 85 було ~70 %; механіка з цього звіту позицію підсилює).

| Хто кличе | Транспорт |
|---|---|
| Адмінка | serverFn, як зараз |
| Зовнішні | один server route `POST /api/v1/<операція>` з токеном |
| OpenAPI 3.1 | генерується з реєстру через `z.toJSONSchema` |
| MCP | у тому ж server route на `WebStandardStreamableHTTPServerTransport` (вибір лінії SDK — окрема розвилка, звіт 85) |
| CLI | тонкий клієнт до того ж HTTP |

Перший крок не залежить від усього решти і корисний сам собою: винести суб'єкт і статус із `runAdmin`/`requireGrant`/
`parseAdminInput` на межу транспорту (3.2).

Проти «перевикористати serverFn як API»: адреса й формат не є контрактом (1.2, 1.4, 2). Проти «лише HTTP і для
адмінки»: можливо пізніше, але зараз це дорожче без нової цінності (4). ~20 % лишаю на те, що власник захоче
«власний корм» одразу заради гарантії повноти, і це теж прийнятна архітектура. ~5 % — на oRPC (звіт 85).

**Пояснення для власника.** Серверна функція — це внутрішній «телефонний дріт» між сторінкою адмінки й сервером.
Номер цього дроту рахується автоматично з назви файлу й версії платформи, а говорять ним спеціальною «мовою»
бібліотеки TanStack. Тому номер змінюється з кожним оновленням, а 1С тієї мови не знає. Подзвонити ним ззовні
технічно можна, але після першого ж оновлення магазину інтеграція мовчки зламається. Водночас усе цінне за дротом
перевикористовується повністю:
- правила перевірки даних (Zod);
- права доступу;
- сама робота з товарами, розділами, замовленнями.

Для 1С, CLI і ШІ-агента ми ставимо другий вхід із постійною адресою, звичайним JSON і ключем доступу замість входу
в адмінку. За ним працює рівно той самий код, що й за адмінкою. Документація цього входу генерується автоматично з
тих самих правил перевірки, тож розійтися з реальністю вона не може. Дублюється лише тонкий «перехідник» біля
дверей, одна обгортка на операцію. Вона вже існує сьогодні.

---

## 7. Що НЕ перевірено

- Живою збіркою **магазину** (pnpm, `node_modules/.pnpm/simplycms@…`) не підтверджено, що версія пакета входить у
  хеш id (1.2). Висновок спирається на код компілятора й дефолт Vite. Хешування на збірці **монорепо** відтворено точно.
- Живим HTTP-запитом не перевірено, що необроблена помилка serverFn без `setResponseStatus` повертає саме 200 (1.4).
  Перевірено лише читанням коду.
- Розмір клієнта для варіанта «власний корм» і зміну бандла не вимірював (4).
- Плагін `api-key` Better Auth і його придатність для токенів інтеграцій не досліджував (1.7). Пропоную власну таблицю
  токенів, але це розвилка для плану.
- `AsyncLocalStorage` проти явного параметра для суб'єкта (3.2) — розвилка для плану. Тут не вирішена.

Скрипти експериментів (поза репо): `<scratchpad>`.
