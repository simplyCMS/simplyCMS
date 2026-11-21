# ADR-0021: Auth — Better Auth; таблиці в `public` з uuid-PK; ролі персоналу — `user_roles`, admin-плагін не вмикаємо

Status: accepted 2026-08-19
Decided by: owner
Spec: `docs/architecture/data-layer.md` §14

## Context
Після зносу Supabase (ADR-0020) потрібна автентифікація всередині процесу магазину. Схема GoTrue `auth.users` зникає. Ролі персоналу мають одне джерело правди. Рішення розвивалось у три кроки: B3 (2026-08-19), амендмент B3′ (2026-08-23) і рішення Г-3 власника (2026-10-07).

## Decision
- Auth — Better Auth, у процесі магазину, з cookie-сесіями.
- Таблиці Better Auth (`users`, `sessions`, `accounts`, `verifications`) — у схемі `public` з uuid-PK. Схема `auth.users` не існує, шимів і view немає.
- Створення `profiles` і ролі — TS-хуки `databaseHooks.user.create.after`, не SQL-тригер.
- Ролі персоналу — таблиця `user_roles` і TS-перевірки. Admin-плагін Better Auth не вмикаємо. Плагінів Better Auth — нуль.

## Why
- B3 і B3′: `docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «2. Зафіксовані рішення (B1–B12».
- Admin-плагін додає `users.role`, друге джерело правди поруч із `user_roles`, і ~15 ендпоінтів на кшталт `impersonateUser`: спека «customers-dashboard-design», розділ «Факти (розвідка 2026-10-07,» (знесено 2026-11-21, текст — `git show a967ab1e`).
- Рішення Г-3: `user_roles` — єдине джерело правди: спека «customers-dashboard-design», розділ «5. Роль адміна (Г-3» (знесено 2026-11-21, текст — `git show a967ab1e`).
- Плагінів нуль свідомо, через CVE-поверхню: спека «customers-dashboard-design», розділ «Факти (розвідка 2026-10-07,» і `packages/simplycms/src/auth/instance.ts` (знесено 2026-11-21, текст — `git show a967ab1e`).
- Таблиця ролей у схемі: `packages/simplycms/src/schema/schema.ts`.

## Rejected
- Admin-плагін Better Auth — друге джерело ролі й ендпоінти, що суперечать `instance.ts:17-19` (`customers-dashboard-design.md:134-136`).
- Схема `auth.users` з шимом чи view — у B3′ записано «зникає як клас».

## Consequences
Роль читається з `user_roles` на кожен запит, тож зняття ролі діє з наступного запиту. Не вмикай admin-плагін і не додавай `users.role`. Не додавай плагіни Better Auth без нового ADR. Перший signup не стає адміном (інваріант `first_user_no_auto_admin`).
