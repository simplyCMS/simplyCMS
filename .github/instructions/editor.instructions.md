---
applyTo: "packages/simplycms/src/{core,admin}/**/*.{ts,tsx},src/**/*.{ts,tsx}"
description: "Правила роботи з rich text редактором (Tiptap v3) в SimplyCMS"
---

# Rich Text Editor Rules

## Архітектура

SimplyCMS використовує **Tiptap v3** для rich text editing. Редактор використовується в:
- Адмін-панелі: опис товарів, налаштування, банери
- Відгуки: форма відгуків з rich text

## ✅ ALWAYS

### Компоненти
- Редактор знаходиться в `simplycms/admin` (для адмін-панелі) та `simplycms/core` (для відгуків).
- Використовуй `RichTextEditor` компонент з відповідного пакету.
- Використовуй `ReviewRichTextEditor` для форми відгуків.

### Контент
- Зберігай контент як **JSON** (Tiptap JSONContent) у PostgreSQL JSONB полях.
- Для readonly відображення використовуй `generateHTML()` з Tiptap utils.
- Не зберігай HTML strings в базі — лише JSONContent.

### Розширення
- Starter Kit + Link + Image + TextAlign + Underline + BubbleMenu (вже налаштовані).
- Для нових розширень — додавай через `@tiptap/*` пакети.
- Dynamic imports для Tiptap компонентів (зменшення bundle для SSR).

## ❌ NEVER
- Не рендери Tiptap в Server Components (лише `'use client'`).
- Не зберігай HTML strings замість JSONContent у базі.
- Не додавай Tiptap розширення без перевірки через MCP context7.
- Не створюй окремі editor-обгортки — використовуй існуючі компоненти.

## ℹ️ Де шукати деталі
- `packages/simplycms/src/admin/components/` — адмін-компоненти з редактором.
- `packages/simplycms/src/core/components/reviews/ReviewRichTextEditor.tsx` — редактор відгуків.
