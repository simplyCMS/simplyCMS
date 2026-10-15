# 87. Спайк oRPC для командного шару SimplyCMS

Дата: 2026-10-14. Код: `~/simplycms-spikes/orpc/` (викидний; `node_modules` видалено).
Репозиторій simplyCMS не чіпали (лише читали `sections/resource.ts`, `columns-to-zod.ts`, `auth/authz.ts`).

## 0. Версії (npm view на 2026-10-14)

| пакет | версія | дата публікації |
|---|---|---|
| @orpc/server, client, openapi, openapi-client, zod, tanstack-query, contract (latest) | 1.15.6 | 2026-10-12 |
| @orpc/* dist-tag `beta` | 2.0.0-beta.43 | 2026-10-09 (паралельна лінія v2, не брали) |
| @tanstack/react-start / react-router / react-query | 1.168.60 / 1.170.41 / 5.104.1 | як у репо |
| react 19.3.0, zod 4.6.5, vite 8.3.2, @vitejs/plugin-react 6.1.1, typescript 6.0.3 | | як у репо |

Ліцензія MIT. Репозиторій насправді `middleapi/orpc` (так в `repository.url` npm; `unnoq/orpc` -- порожня заглушка з 7 зірками): 5684 зірки, 171 форк, 30 відкритих issue, остання активність 2026-10-14, реліз 1.x приблизно щотижня (1.15.5 -> 1.15.6 за 5 днів, паралельно 2.0.0-beta.41..43). Контриб'ютори: dinwwwh 1306 комітів, далі Mnigos 5, Copilot 4 (люди; решта боти). За 90 днів: dinwwwh 363 коміти, усі інші люди разом близько 6. Автобус-фактор = 1 підтверджено (високий темп, але одна людина).

## 1-2. Застосунок і виклик процедури

Мінімальний Start на версіях репо (`@tanstack/react-start/plugin/vite`), `vite build` проходить. Три процедури + `whoami`, Zod 4 схеми за мотивом розділу: uuid `id` від викликача, `Date` (publishAt/createdAt/updatedAt), nullable, enum, масив, numeric-рядок, `translations: Record<'uk'|'en'|'pl', {name, description|null}>`.

- (а) Клієнт: `createORPCClient(RPCLink)` + `createTanstackQueryUtils` (`orpc.sections.list.queryOptions(...)`) -- типобезпека повна. tsc ловить помилки на місці (напр. відсутні ключі локалей), `createdAt` типізовано як `Date` і в рантаймі це справді `Date` (RPCLink серіалізує Date через `meta`: `"meta":[[1,0,"createdAt"],...]`). Також `createRouterClient(router,{context})` -- виклик in-process без HTTP (для serverFn/CLI): працює, Date зберігається, анонім -> `UNAUTHORIZED 401`.
- (б) HTTP: server route `src/routes/api/v1/$.ts` (`server.handlers.POST`) + `OpenAPIHandler` з `route({method:'POST', path:'/sections.create'})`. Працює з curl (див. п. 3).
- Пастка: `OpenAPILink` (типізований HTTP-клієнт) повертає `createdAt` як `string`, хоча тип каже `Date` (перевірено: `typeof = string`). Для внутрішнього клієнта брати `RPCLink`.
- SSR: сторінка `/` рендериться (200).

## 3. Контекст, middleware, помилки (curl)

Один middleware: суб'єкт з `Authorization: Bearer tok_*` АБО cookie `session=sess_*`, потім перевірка права за копією `AUTHZ_MATRIX`.

```
whoami anon            -> 200 {"userId":null,"roles":[],"via":"anon"}
whoami Bearer tok_admin-> {"userId":"1111...","roles":["admin"],"via":"bearer"}
whoami cookie sess_user-> {"userId":"2222...","roles":["user"],"via":"cookie"}
create anon            -> 401 application/problem+json {"type":"urn:simplycms:error:unauthorized","title":"UNAUTHORIZED","status":401,"detail":"Потрібна автентифікація"}
create tok_user        -> 403 {"title":"FORBIDDEN","detail":"Операція заборонена: catalog.write","data":{"operation":"catalog.write"}}
create tok_admin       -> 200 (JSON розділу, publishAt/createdAt ISO)
create дубль           -> 409 {"title":"CONFLICT",...}
get неіснуючого        -> 404 NOT_FOUND
невідома операція/GET  -> 404 problem+json
```

- problem+json НЕ нативний: oRPC віддає своє тіло `{defined,code,status,message,data}`; я зробив обгортку `toProblem` (~15 рядків у `src/orpc/handlers.ts`). Працює, але це наш код.
- Помилка валідації -> 400, але `data.issues` -- сирі issue Zod (з regex-патернами UUID тощо). Нам знадобиться власний санітайзер (як `sanitizeValidationIssues`).
- Помилки в OpenAPI-документі не описані (лише `200`), якщо не декларувати `.errors({...})` на кожній процедурі.

## 4. 🔴 Пастка Date на HTTP

Без плагіна `POST` з `"publishAt":"2026-11-01T10:00:00.000Z"` дає 400: `expected date, received string`, при тому що OpenAPI-документ заявляє `string/date-time`. Тобто документ і валідатор розходяться. Лікується `experimental_ZodSmartCoercionPlugin` (з `@orpc/zod/zod4`, плагін `OpenAPIHandler`): після нього ISO-рядок приймається, `"limit":"5"` теж коериться. Плагін ЕКСПЕРИМЕНТАЛЬНИЙ (назва з префіксом). Zod-кодек (`z.codec`) для цього не підходить: вихід процедури валідується як input кодека.

## 5. OpenAPI (файл `openapi.v1.json`, 3.1.1)

`OpenAPIGenerator({schemaConverters:[new ZodToJsonSchemaConverter()]})` з `@orpc/zod/zod4`. Коректно: `uuid` -> `{"type":"string","format":"uuid"}`; nullable -> `anyOf[..., {"type":"null"}]`; `Date` -> `{"type":"string","format":"date-time","x-native-type":"date"}`; `Record<enum,...>` -> `object` з `propertyNames.enum` + `additionalProperties`; `.refine` (зарезервований slug) не представлено (очікувано); `securitySchemes` bearer, `operationId`, `tags` (право) -- через `route({...})`. `z.toJSONSchema` у чистому Zod 4 на `z.date()` ПАДАЄ (`Date cannot be represented in JSON Schema`); oRPC-конвертер це обробляє сам.

## 5b. JSON Schema для MCP

`new ZodToJsonSchemaConverter().convert(schema, {strategy:'input'|'output'})` повертає `[required, jsonSchema]`. Схема входу з конвертера === схемі `requestBody` в OpenAPI (deep-equal true), так само для виходу. Тобто MCP і OpenAPI збігаються за побудовою. Нативний `z.toJSONSchema(..., {unrepresentable:'any'})` відрізняється (Date -> `{}`, `$schema`, довгий UUID-pattern, `type:["string","null"]`). Файли: `mcp-sections-create.input.schema.json`, `native-zod-sections-create.input.schema.json`.

## 6. Збірка

`vite build` ок. Клієнтський чанк роуту з oRPC-клієнтом + tanstack-query utils: 36.85 kB (gzip 12.63) проти 8.06 kB (gzip 2.99) у еквівалентного baseline без oRPC => приблизно +28.8 kB raw / +9.6 kB gzip на клієнт (спайк мінімальний; без tree-shaking реального застосунку це верхня оцінка для RPCLink+utils). Серверний бандл: `handlers` 6.6 kB + спільні чанки. Диск: node_modules усього спайку 159 MB (Start, vite), @orpc/* -- кілька МБ.

## 7. Підтвердження тверджень верифікації

- `@orpc/zod` (корінь) тягне `zod/v3` -- ПІДТВЕРДЖЕНО: `dist/index.mjs` рядок 1 `import {...} from 'zod/v3'`; корінний конвертер на Zod 4 схемі: `condition(...) === false` (схему не розпізнає). Для Zod 4 -- лише `@orpc/zod/zod4` (експорт `./zod4` є; peer `zod >=3.25`).
- oRPC приймає Standard Schema без адаптера -- ПІДТВЕРДЖЕНО: `.input(zodSchema)` валідує в рантаймі й виводить типи; адаптер `@orpc/zod/zod4` потрібен ЛИШЕ для OpenAPI/JSON Schema та smart-coercion.
- Мейнтейнер фактично один -- ПІДТВЕРДЖЕНО (див. п. 0), попри активну розробку (2.0 beta).
- Стан API: деякі речі в Start 1.168.60 -- `inputValidator()` у `createServerFn` вже deprecated, лишається `.validator()` (як у AGENTS.md).

## 8. Альтернатива: власний реєстр команд (`src/custom/`)

`defineOperation({name,input,output,permission,handler})` + `execute` (суб'єкт -> право -> валідація -> handler -> валідація виходу) + HTTP-адаптер (problem+json) + `reviveDates` (аналог smart-coercion, ~12 рядків) + OpenAPI 3.1 і JSON Schema з `z.toJSONSchema({io, unrepresentable:'any', override: Date -> date-time})` + serverFn-адаптер. Перевірено curl тими самими кейсами: 401/403/409/404/400 problem+json, ISO-дата на вході, Bearer/cookie; серверна fn `/sf` у SSR-лоадері з cookie `sess_admin` -> `["shoes:true"]` (Date зберігся), анонім -> повідомлення "Потрібна автентифікація".

Обсяг (рядки, без схем і ядра, які спільні):

| | oRPC | власний |
|---|---|---|
| оголошення процедур/операцій | 49 (router.ts, включно з middleware і helper `op`) | 13 (operations.ts) + 22 з `execute`/контекстом у registry |
| HTTP-адаптер + problem+json + coercion | 33 (handlers.ts, з них problem+json мій) | ~35 в registry.ts (handleHttp + reviveDates) |
| OpenAPI + JSON Schema | 13 (скрипт) | ~12 в registry.ts |
| роути server route | 9 + 8 (v1, rpc) | 7 |
| клієнт | 9 (client.ts, повна типізація + TanStack Query utils) | 13 serverFns.ts (по одному top-level const на операцію) |
| разом | ~121 | ~102 |

Відмінності по суті:
- Власний: різниця в рядках мізерна (~20), але ми володіємо коректністю Date/OpenAPI і санітизацією; НЕМА типізованого HTTP-клієнта (для зовнішніх споживачів достатньо OpenAPI), клієнт для адмінки -- serverFn як сьогодні (по top-level const на операцію; `createServerFn` мусить бути top-level -- фабрика навколо нього в спайку не перевірялась). Відмінності схем: OpenAPI у власному дає `date-time` без `x-native-type`, UUID з довгим pattern.
- oRPC дає безкоштовно: типізований клієнт з TanStack Query, in-process клієнт, middleware-ланцюжки, RPC-протокол зі збереженням Date/Map/Set, OpenAPILink, готовий шлях до MCP-схем з одним конвертером. Мінуси: експериментальний coercion-плагін, обгортка під problem+json, санітизація issue, один мейнтейнер, 1.x/2.0-beta розвилка, Zod 4 лише через `/zod4`.

## Висновок

Технічно oRPC 1.15.6 на Zod 4 + TanStack Start працює: один router -> RPC для адмінки з повною типобезпекою, `POST /api/v1/<op>` для токена, OpenAPI 3.1 і JSON Schema, що збігаються. Блокерів не знайдено; вимагають уваги: Date на HTTP (експериментальний плагін), problem+json (наш код), сирі Zod-issue, OpenAPILink бреше типом Date, ризик одного мейнтейнера і v2-beta. Власний реєстр -- реальна альтернатива за ~100 рядків, якщо не потрібні типізований HTTP-клієнт і готові middleware; вибір залежить від того, чи цінується типізований клієнт для зовнішніх споживачів більше за залежність від одного мейнтейнера.

## Файли

`openapi.v1.json` (oRPC), `openapi.custom.json` (власний), `mcp-sections-create.input.schema.json`, `native-zod-sections-create.input.schema.json`, `src/orpc/*`, `src/custom/*`, `scripts/*`.
