# ADR-0034: Drizzle лишається на 0.x до stable 1.0; перегляд ORM, якщо stable не вийде до 2027-04-01

Status: accepted 2026-10-04
Decided by: owner
Spec: `docs/architecture/data-layer.md` §7

## Context
Drizzle 1.0 перебуває в RC з 2026-04-30. Лінія 0.45 майже не оновлюється. Власник доручив спайк міграції на `1.0.0-rc.4` у тимчасовому worktree. Спайк оцінив вигоди як близькі до нуля, а ризики як реальні.

## Decision
- Магазин і ядро лишаються на `drizzle-orm` 0.45.x, доки не вийде `1.0.0` stable. На RC не мігруємо.
- Після stable міграція займає 0,5–1 день: 3 правки коду, `drizzle-kit up`, `db-diff.mjs`, `schema-sources-parity`, peer-діапазон.
- Умова перегляду ORM: stable `1.0.0` не вийшла до 2027-04-01, або генерація міграцій дає відтворюваний дефект, який наші гейти не ловлять.
- Тоді оцінюємо альтернативи: Kysely з засобом міграцій і MikroORM.
- Баг drizzle-kit (прибраний `using` при наявному `withCheck`) записано в реєстр обхідних шляхів.

## Why
- Вигоди RC для нас близькі до нуля: DZOD-1 і DRZ-1 не лікуються (спека «deps-security-tooling-design», розділ «7в · Drizzle 1.0 — чекати stable ✅»; знесено 2026-11-21, текст — `git show a967ab1e`).
- `scripts/db-diff.mjs` на 1.0 мовчки бреше: друкує «змін немає», хоча міграцію створено (спека «deps-security-tooling-design», розділ «Спайк Drizzle 1.0 RC (2026-10-04, тимчасовий worktree, код не збережено»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Прибрати `using`, лишивши `withCheck`, некоректно на обох версіях. Захист — `rls-parity.test.ts` (спека «deps-security-tooling-design», розділ «Спайк Drizzle 1.0 RC (2026-10-04, тимчасовий worktree, код не збережено»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Стан у коді: `package.json` (`"drizzle-orm": "0.45.4"`), `packages/simplycms/package.json` (`^0.45.0`).

## Rejected
- Мігрувати на 1.0 RC — вигод нема, тулінг ненадійний.
- Kysely — втрачає схему в TS.
- MikroORM 7.2 — RLS менше місяця.
- Prisma — без RLS.

## Consequences
- При кожному бампі Drizzle перевіряй записи реєстру `docs/architecture/upstream-workarounds.md`.
- Дата 2027-04-01 — свідомий строк перегляду. Не мігруй раніше без нового рішення.
- У рев'ю міграцій політик окремо дивись на видалення виразів.
