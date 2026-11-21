# ADR-0003: Ядро володіє каркасом роутів (virtualRouteConfig + physical); сторінки ядра не перевизначаються

Status: accepted 2026-07-30
Decided by: owner
Spec: `docs/architecture/rendering-and-routing.md` §1

## Context
Магазин має бути тонкою збіркою, а не форком репозиторію.
Нова сторінка ядра мусить доїжджати до магазину після `pnpm update` без ручного переносу.
TanStack Router вміє монтувати теки з route-файлами за межами `src/routes` через `physical()`.
Власник обрав варіант A: ядро володіє каркасом, магазин додає лише власні сторінки.

## Decision
Дерево роутів збирає `routes.ts` через `virtualRouteConfig` і `physical()`.
Канонічні сторінки вітрини й адмінки лежать у пакеті ядра й не перевизначаються.
Плагін лише додає сторінки адмінки під `/admin/<slug>/…`.
Магазин додає власні сторінки лише в теці `my/`.

## Why
- D2: «Адмінка: перевизначення сторінок не існує»; плагіни лише додають (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «2. Зафіксовані рішення власника»).
- D3: канонічні сторінки вітрини — частина ядра, не перевизначаються (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «2. Зафіксовані рішення власника»).
- Експеримент підтвердив: нова сторінка пакета з'являється в магазині без нового файлу в ньому (`docs/architecture/platform-delivery-options.md` § «2.1. Головний технічний факт (верифіковано експериментально»).
- Перевизначення роуту ядра дає фатальний конфлікт генератора, а не shadowing (`docs/architecture/platform-delivery-options.md` § «2.1. Головний технічний факт (верифіковано експериментально»).
- Код: `routes.ts` монтує `packages/simplycms/routes/storefront`, `routes/admin`, плагін і `my`.
- Канон: `docs/architecture/rendering-and-routing.md` § «1. Дерево роутів».

## Rejected
- Code-based routing — TanStack Start його не підтримує (`docs/architecture/platform-delivery-options.md` § «2.1. Головний технічний факт (верифіковано експериментально»).
- Перевизначення роуту ядра в магазині через `routeFileIgnorePattern` — глобальний regex по basename, крихкий (`docs/architecture/platform-delivery-options.md` § «2.1. Головний технічний факт (верифіковано експериментально»).

## Consequences
Нова сторінка ядра не потребує змін у магазині.
Файл поруч із `__root.tsx` роутом не стає: монтується лише `my/`.
Не можна «виправляти» кастомізацію сторінки підміною роуту.
Зміну вигляду сторінок вітрини дозволяє лише ADR-0013, і лише на рівні презентації.
