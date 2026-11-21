# ADR-0055: Запис адмінки й API — лише операції реєстру; HTTP `/api/v1`; serverFn — тонка обгортка

Status: accepted 2026-10-14
Decided by: owner
Spec: `docs/architecture/operations-api.md` §1

## Context
Адмінка пише через серверні функції TanStack Start. Зовнішні клієнти (плагіни-перекладачі, CLI, MCP) теж мусять писати. Серверну функцію технічно можна викликати ззовні, але це крихкий протокол без контракту.

## Decision
- Запис адмінки й API йде лише через операції реєстру (`defineOperation`).
- Адмінка лишається на serverFn як тонких обгортках над реєстром.
- Зовнішні клієнти мають один вхід: `POST /api/v1/<операція>` з токеном. OpenAPI й MCP генеруються з реєстру.
- Захист від обходу — два шари: тест парності (кожна операція має обгортку й проходить через HTTP-адаптер) і лінт.
- Лінт ловить: serverFn без делегування операції, логіку в тілі обгортки, виклик ядер `*In` і `withActor` поза операцією.

## Why
- Рішення власника (Р-ML-3): `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника». Вимога власника про два шари — «щоб в подальшому важко було порушити» (`docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника»).
- Адреса serverFn — хеш шляху файлу й імені змінної; тіло — seroval, не JSON; суб'єкт лише з cookie: `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника».
- Канон: `docs/architecture/operations-api.md` § «Реєстр операцій і HTTP API».
- Лінт-правила `thin-server-fn` і `no-core-outside-operation`: `eslint.config.mjs`.
- Вхід HTTP: `packages/simplycms/routes/storefront/api/v1/$op.tsx`. Знімок контракту: `packages/simplycms/api/openapi.core.json`.
- Тест парності: `packages/simplycms/src/admin-server/impl/__tests__/registry-parity.test.ts`.

## Rejected
- Адмінка теж через HTTP — ~20% в оцінці архітектора, не обрано (`docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника»).
- oRPC — ~5%: потребує експериментального плагіна для дат, один мейнтейнер, ~10 кБ gzip (`docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника»).
- Виклик серверних функцій ззовні — крихкий внутрішній протокол (`docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «, 2026-10-14) — рекомендація архітектора, чекає рішення власника»).

## Consequences
- Одна логіка запису для адмінки й зовнішніх клієнтів. Права, схеми Zod і ядра `*In` перевикористано.
- Нова операція — це запис у реєстрі й тонка обгортка; логіку в обгортку не класти.
- Легасі-перелік serverFn скорочується до нуля в М3 (`eslint-rules/legacy-admin-server-fns.json`).
- Не обходити лінт через `eslint-disable`: це порушує рішення власника.
