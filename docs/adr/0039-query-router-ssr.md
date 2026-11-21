# ADR-0039: Дані сторінки вітрини — один запит і одна транзакція через інтеграцію Query з Router SSR

Status: proposed
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6»

## Context
Спайк 2026-10-05 показав дефект свіжості. Зміна назви товару не з'являлася на головній навіть через 310 с.
SWR-`loaderData` засіває запис Query, а свіжий `initialData` на наявний запис не діє.
Свіжістю керують два власники: `staleTime` маршруту і `staleTime` Query.

## Decision
Дані сторінки бере одна server function в одній транзакції. Лоадер розкладає частини в дрібні ключі через `setQueryData`.
Політика свіжості живе лише у фабриках `queryOptions` сутності; `staleTime` маршрутів прибрано.
Інтеграція — `@tanstack/react-router-ssr-query`, точний пін у шаблоні магазину.

## Why
- Дві політики свіжості не узгоджені, UI показує старі дані (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).
- Пілот інтеграції на головній дав свіжі дані через 310 с і 0 зайвих клієнтських запитів (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).
- Шість паралельних транзакцій — шість з'єднань пулу на перегляд, ризик вичерпання пулу (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).

## Rejected
- Дрібні самостійні ключі на кожну частину сторінки — 6 транзакцій на SSR замість 1 (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).

## Consequences
- Стан на 2026-11-21: у коді ще немає (`git grep react-router-ssr-query` — 0 збігів у `packages`, `src`).
- Статус `proposed`: розгортання по сторінках потребує окремого плану (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).
- Магазин отримує нову залежність і змінений файл каркаса `src/router.tsx` (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 6 · TanStack Query + SSR-інтеграція Router ✅ (окремий план»).
