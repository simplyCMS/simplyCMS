# ADR-0027: Чистий baseline з Drizzle замість 33 історичних міграцій

Status: accepted 2026-08-23
Decided by: owner
Spec: `docs/architecture/data-layer.md` §7

## Context
33 файли `supabase/migrations/` описували еволюцію демо-магазину `alterenergy`. Вони містили FK на `auth.users`, об'єкти Supabase Storage і `DO $$`-фокуси. Для нового стека вони не працюють. Клієнтів і реальних магазинів немає.

## Decision
- Історичні міграції видалено повністю. Вони лишаються лише в git-історії.
- Схема — `packages/simplycms/src/schema/schema.ts` (Drizzle). З неї генерується одна baseline-міграція `0001_init.sql`.
- Поруч лежать ручні файли `0000_prelude`, `0002_grants`, `0003_seed`, `0004_functions`.
- Сід — чиста БД без власника, готова прийняти першого власника через invite.
- Baseline перегенерує `pnpm db:rebaseline`. Тека `supabase/` у репо не потрібна.

## Why
- `schema.ts` уже був джерелом правди; це доводив тест `rls-parity` (`docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «2. Зафіксовані рішення (B1–B12»).
- Без клієнтів немає чого мігрувати. Перезапуск `alterenergy` робить `pg_dump` даних, а не DDL-реплей (`docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «2. Зафіксовані рішення (B1–B12»).
- Зникає вічний шим реплею старих міграцій (8 посилань на `auth.users`).
- Стан у коді: `package.json` (`db:rebaseline`), `packages/simplycms/migrations/0001_init.sql`; теки `supabase/` немає.

## Rejected
- Зберегти 33 історичні міграції — вони неробочі для чистого Postgres.

## Consequences
- До `1.0.0-rc.1` baseline правлять як виняток; кожна така правка дає в `CHANGELOG` рядок «перестворити БД» (`docs/architecture/data-layer.md` § «7. Міграції»).
- Після `1.0.0-rc.1` застосовану міграцію не правлять. Схема міняється лише новими файлами через `pnpm db:diff`.
- Плагіни `plg_*` докочуються поверх baseline.
