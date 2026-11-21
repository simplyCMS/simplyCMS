# ADR-0032: Дати в застосунку — `Date`; пул має `DateStyle=ISO`, `TimeZone=UTC`

Status: accepted 2026-09-03
Decided by: owner
Spec: `docs/architecture/data-layer.md` §6

## Context
Колонки з `mode: 'string'` віддавали сирий текст Postgres, а не ISO. Текст залежав від налаштувань кластера. Рядок замість `Date` дав би `RangeError` у `Intl` на сторінці успішного замовлення. Парсер типів `pg` для доменних запитів Drizzle не діє.

## Decision
- Усі `timestamp` доменної схеми мають `mode: 'date'`. У застосунку дата — `Date`.
- Рядком дата стає лише на межі виводу: `toISOString()` у sitemap, `Intl.DateTimeFormat` у UI.
- Пул `simplycms/db` ставить на кожне зʼєднання `options: '-c DateStyle=ISO,YMD -c TimeZone=UTC'`.
- `new Date(рядок)` у коді вітрини — сигнал, що межу перетнули не там.

## Why
- Startup-опції пулу робить текст драйвера детермінованим незалежно від кластера (спека «k2-e0-storefront-live-contour-design», розділ «К2-Е0»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- DDL не змінюється: `mode` — властивість TS-типу (спека «k2-e0-storefront-live-contour-design», розділ «К2-Е0»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- `pg.types.setTypeParser` для дат мертвий: Drizzle підкладає identity-парсер (спека «k2-e0-storefront-live-contour-design», розділ «Додаток Б. Відкинуті альтернативи (з причиною, доведеною кодом»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- Стан у коді: `packages/simplycms/src/db/client.ts`; канон — `docs/architecture/data-layer.md` § «6. Контракт дат».

## Rejected
- `pg.types.setTypeParser` для дат — не діє на доменні запити Drizzle.
- `customType()` у схемі — у репо не вживається; механізм `mode: 'date'` уже є в auth-схемі.
- Фікстури у форматі драйвера — формат залежить від GUC кластера; тест пінив би оточення.
- `<ClientOnly>` навколо бейджів — кладе обов'язок на кожну тему, дефект у даних лишається.

## Consequences
- Через loader-payload і serverFn `Date` проходить як `Date`. Нові колекції адмінки теж приймають `Date`.
- Не повертай `mode: 'string'` у доменну схему. Є один коментар про це в `packages/simplycms/src/schema/schema.ts`.
