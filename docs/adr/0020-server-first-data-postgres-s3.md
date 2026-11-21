# ADR-0020: Server-first дані: браузер не ходить у БД; чистий Postgres і S3; Supabase — лише один з провайдерів

Status: accepted 2026-08-19
Supersedes: ADR-0007
Decided by: owner
Spec: `docs/architecture/data-layer.md` §1

## Context
Раніше фундаментом був Supabase: PostgREST, GoTrue, Storage. Це давало 4–5 stateful-компонентів на магазин. Це зв'язувало платформу з churn самохостного Supabase. Платформа має працювати на будь-якому Postgres і будь-якому S3-сумісному сховищі.

## Decision
- B1: браузер не звертається до БД ні напряму, ні через PostgREST. Шлях даних: route loader → `createServerFn` → Drizzle → Postgres. Клієнтський рантайм ходить через ті самі serverFn.
- B2: контракт бекенда — чистий Postgres і S3-сумісне сховище. Supabase — один з підтримуваних провайдерів, не обов'язковий фундамент.
- D7′: PostgREST зникає зі стека.

## Why
- B1 і B2 записані власником: `docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «2. Зафіксовані рішення (B1–B12».
- Результат: 2 stateful-компоненти на магазин замість 4–5 і незалежність від churn самохостного Supabase: `docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «мінімальний Supabase-стек».
- Код дотримується: імпорт `@supabase/*` у `packages/`, `template/` і `src` — нуль; ратчет `eslint-rules/no-supabase-import.mjs` і `AGENTS.md` § «Архітектурні інваріанти».
- Канон: «Шару `supabase-js` більше немає (К3-Е7)»: `docs/architecture/data-layer.md` § «3. Адмінка».

## Rejected
- у джерелі не записано

## Consequences
Усі дані йдуть через серверні функції й `withActor`. Не повертай `@supabase/*` у репо: лінт це забороняє. Supabase лишається допустимим як звичайний Postgres і S3-ендпоінт. Міграції не йдуть через Supabase MCP, він лише для інспекції (`docs/architecture/data-layer.md` § «7. Міграції»).
