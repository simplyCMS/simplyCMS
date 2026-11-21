# ADR-0007: Бекенд — Supabase: один пакет `@simplycms/supabase`, міграції через Supabase CLI

Status: superseded by ADR-0020
Decided by: owner
Spec: `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` §9, §10

## Context
На 2026-07-30 платформа працювала на Supabase: клієнти `supabase-js`, PostgREST, GoTrue.
Клієнтський код розкидали по кількох місцях.
Міграції застосовував власний скрипт `supabase/scripts/migrate.mjs`.
Спека напрямку вирішила звести Supabase-шар в один пакет і перейти на типізовану схему Drizzle.

## Decision
Усе, що стосується Supabase, живе в одному пакеті `@simplycms/supabase`.
Схема ядра й плагінів — Drizzle TS, разом з RLS.
`simplycms db:diff` складає одну SQL-міграцію, людина її переглядає, застосовує Supabase CLI.
Доступ до даних лишається на `supabase-js` і PostgREST.

## Why
- D6: схема — Drizzle TS, зведена diff-міграція, людське ревʼю, Supabase CLI (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «2. Зафіксовані рішення власника»).
- D7: консолідація в один пакет за зразком `metahub/packages/supabase`, звірено з quickstart Supabase (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «2. Зафіксовані рішення власника»).
- Склад пакета й конвеєр міграцій описано в §10 і §9 (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «10. Supabase-шар», `363-367`).
- Саморобний `migrate.mjs` виводиться з експлуатації (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «9. Дані: Drizzle-схема, міграції, типи»).

## Rejected
- Саморобний `supabase/scripts/migrate.mjs` — замінено конвеєром Drizzle; окрему причину в джерелі не записано.

## Consequences
Рішення замінене ADR-0020 від 2026-08-19: браузер більше не ходить у БД, Supabase став лише одним з провайдерів.
Пакета `@simplycms/supabase` немає: код `@supabase/*` у репо заборонено лінтом (ADR-0043).
Частина рішення живе далі: схема — Drizzle TS, міграції — людське ревʼю.
Не можна повертати пакет чи Supabase CLI як обов'язковий шлях.
