# ADR-0045: Кожен магазин — власний кластер Postgres; роль накату — SUPERUSER

Status: accepted 2026-10-12
Decided by: architect
Spec: `docs/architecture/data-layer.md` §1

## Context
Ролі `app_runtime`, `app_user`, `app_admin` у PostgreSQL кластерні, а не побазові. Прелюдія `0000_prelude.sql` приводить їхні атрибути до канону. Змінити SUPERUSER і BYPASSRLS може лише суперкористувач. У спільному кластері з «попереднім життям» роль може вже існувати з чужими атрибутами.

## Decision
1. Кожен магазин має власний екземпляр Postgres (Р28б).
2. Роль накату — SUPERUSER кластера.
3. Керовані Postgres, де роль має лише CREATEROLE (Supabase, RDS тощо), не підтримуються.
4. `doctor --online` попереджає про інші бази з журналом або з `CONNECT` для `app_runtime` (код `shared-cluster`, Р28б′).

## Why
- Рішення Р28 і розвилка архітектора: спека «pilot-readiness-design», розділ «Рішення власника» (знесено 2026-11-21, текст — `git show a967ab1e`).
- Канон моделі даних: `docs/architecture/data-layer.md` § «1. Модель».
- Прелюдія: `alter role` виконується завжди на свіжому кластері, тож потрібен SUPERUSER: `packages/simplycms/migrations/0000_prelude.sql`.
- Атрибути ролей у прелюдії: `packages/simplycms/migrations/0000_prelude.sql`.
- Опис ролі накату: `docs/development/ENVIRONMENT.md` § «Групи драйверів».

## Rejected
- Спільний кластер на кілька магазинів — ролі кластерні, тож магазини ділили б чужі атрибути й спричиняли б `tuple concurrently updated` (`packages/simplycms/migrations/0000_prelude.sql`, коментар про два паралельні накати на одному кластері).
- Керований Postgres без SUPERUSER — прелюдія не зможе привести атрибути до канону.

## Consequences
- Магазин ставить Postgres сам (Dokploy-сервіс). Керовані хмарні БД без SUPERUSER не підходять.
- Не послаблюй роль накату до CREATEROLE: канон ролей перестане гарантуватися.
- Повторний накат міняє роль лише коли стан відрізняється від канону. Це свідомо, через гонки на `pg_authid`.
