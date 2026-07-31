---
applyTo: '**/*'
description: 'Стиль коду, форматування та документація'
---

# Coding Style Rules

## TypeScript
- **Strict mode** — заборонено `any` (використовуй `unknown` або конкретні типи).
- `interface` для об'єктів, `type` для union/intersection/utility.
- Експортуй типи через `export type` / `export interface`.
- Використовуй generic типи де це покращує повторне використання.

## Форматування
- 2 пробіли для відступів.
- Максимум 100 символів на рядок.
- Одинарні лапки для рядків.
- Trailing commas.
- Крапка з комою в кінці рядків.

## Назви
- `camelCase` для змінних, функцій, хуків.
- `PascalCase` для компонентів, типів, інтерфейсів.
- `UPPER_SNAKE_CASE` для констант.
- Змістовні імена: `fetchProducts`, не `getData`.
- Хуки починаються з `use`: `useCart`, `usePriceType`.
- Назви файлів компонентів — `PascalCase.tsx`.
- Назви файлів утиліт/хуків — `camelCase.ts`.

## Документація
- Коментарі і документація **українською мовою**.
- Пояснюй **ЧОМУ**, а не що (код має бути самодокументованим).
- JSDoc для public API функцій та типів:
  ```typescript
  /** Розраховує знижку на основі правил групи */
  export function resolveDiscount(context: DiscountContext): DiscountResult { ... }
  ```

## Структура файлу
- Imports завжди на початку (бібліотеки → пакети → локальні).
- Типи/інтерфейси → утиліти → компонент/функція → exports.
- Один клас або компонент на файл.
- Максимум 150 рядків на файл (розбивай на менші модулі).

## React patterns
- Server Components за замовчуванням.
- `'use client'` лише для: стан, ефекти, browser API, обробники подій.
- Деструктуризація props: `function ProductCard({ product, onAdd }: ProductCardProps)`.
- Використовуй `forwardRef` для UI-компонентів що проксують ref.
- Обробка помилок через Error Boundaries.

## Imports
- Використовуй `@simplycms/*` path aliases для пакетів ядра.
- Використовуй `@/*` для файлів з `app/` директорії.
- Використовуй `@themes/*` та `@plugins/*` для тем/плагінів.
- Не використовуй relative imports (`../../..`) для cross-package imports.

## ❌ NEVER
- `any` типи (використовуй `unknown`, generic або конкретний тип).
- Magic numbers без пояснень (виноси в іменовані константи).
- Глибокий nesting > 3 рівнів (рефактори через early return).
- Дублювання коду (виноси у спільні утиліти).
- `console.log` у production коді (використовуй `console.error` для помилок).
