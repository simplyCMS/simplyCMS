# ADR-0031: `createServerFn` — лише топ-рівнева константа; фабрика видає операції

Status: accepted 2026-08-31
Decided by: owner
Spec: `docs/architecture/data-layer.md` §2

## Context
Фабрика `defineAdminResource` мала б видавати готові серверні функції для 34 сутностей. Компілятор TanStack Start розпізнає `createServerFn` лише в певній формі. Спершу фабрика повертала serverFn, а ревізія 2026-08-31 це скасувала.

## Decision
- `createServerFn` присвоюється топ-рівневій змінній модуля простим ідентифікатором.
- Фабрика `defineAdminResource` повертає plain async-операції `{ list, insert, update, remove }` і Zod-схеми. Вона не повертає serverFn.
- Кожен serverFn оголошується явно топ-рівневим `const` (4–6 рядків на сутність).
- Операції з інваріантами (наприклад `changeStatus`) пишуться руками, а не з фабрики.
- Запобіжник — ESLint-правило: `createServerFn` лише в топ-рівневому `VariableDeclarator`.

## Why
- Компілятор вимагає присвоєння простим ідентифікатором (`handleCreateServerFn.js:104-106` у `@tanstack/start-plugin-core`).
- Fast-path компілятора для файлів із serverFn сканує лише топ-рівень. Виклик усередині фабрики не падає, а мовчки лишається нетрансформованим. Серверний граф тоді їде в клієнтський бандл (спека «v2-k3-admin-server-layer-design», розділ «2. Рішення (К3-1 … К3-12»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- Операції тестуються без рантайму Start. `.inputValidator` вирізається на клієнті (спека «v2-k3-admin-server-layer-design», розділ «2. Рішення (К3-1 … К3-12»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- Стан у коді: `eslint-rules/server-fn-top-level.mjs`, зона правила в `eslint.config.mjs`; канон — `docs/architecture/data-layer.md` § «2. Вітрина (SSR».

## Rejected
- Фабрика, що видає serverFn — мовчки ламає трансформацію компілятора.
- Дескриптор з DSL запитів (вкладені фільтри, `or`, підзапити) — тримає фабрику в межах ~150 рядків; складне робить `useLiveQuery` або іменована операція.

## Consequences
- Кожна нова сутність потребує явних `const` для serverFn. Це дублювання свідоме.
- Не «пересувай» `createServerFn` усередину фабрики чи хелпера. Збірка не впаде, але клієнт отримає серверний код.
- Селектори правила лінту не послабляй (`AGENTS.md`, розділ «Команди»).
