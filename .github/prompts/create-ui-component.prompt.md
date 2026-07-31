---
description: "Створити UI компонент для дизайн-системи SimplyCMS"
---

# Генерація UI компонента

Створи новий UI компонент для дизайн-системи SimplyCMS:

## Специфікація компонента:

**Назва:** [Назва компонента]
**Пакет:** [@simplycms/ui | @simplycms/core | themes/default]
**Призначення:** [Опис що робить компонент]

## Правила розміщення:

- **@simplycms/ui** — базові UI компоненти (shadcn/ui based): Button, Input, Dialog, etc.
- **@simplycms/core** — бізнес-компоненти: ProductCard, CartItem, CheckoutForm, etc.
- **@simplycms/admin** — адмін-компоненти: ImageUpload, ProductPricesEditor, etc.
- **themes/default** — theme-specific компоненти: Header, Footer, HeroBanner, etc.

## Вимоги:

1. **TypeScript та типізація**
   - Чіткі інтерфейси для props
   - Generic типи де потрібно
   - Експорт типів для зовнішнього використання

2. **Стилізація**
   - Використовуй Tailwind CSS класи
   - Реалізуй варіанти через `class-variance-authority`
   - `cn()` з `@simplycms/core` для злиття класів
   - Responsive дизайн (mobile-first)
   - Dark mode підтримка через CSS variables

3. **Функціональність**
   - `forwardRef` для проксування refs
   - Keyboard navigation та focus management
   - ARIA атрибути для доступності

4. **Rendering**
   - Server Component за замовчуванням
   - `'use client'` лише якщо потрібен стан/ефекти/обробники подій

## Перевір через MCP:

1. **shadcn** — `search_items_in_registries` → чи є готовий компонент
2. **shadcn** — `get_item_examples_from_registries` → приклади використання
3. **shadcn** — `get_audit_checklist` → після додавання
4. **context7** — Radix UI docs якщо використовується

## Включи:

- [ ] Основний компонент з усіма варіантами
- [ ] TypeScript типи та інтерфейси
- [ ] Експорт з index.ts відповідного пакету
- [ ] Документацію з прикладами використання
