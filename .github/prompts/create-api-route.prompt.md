---
description: "Створити server route (TanStack Start) в SimplyCMS"
---

# Створення API роута

Створи новий server route для TanStack Start (src/routes/api/, server.handlers) з такими вимогами:

## Специфікація API:

**Метод:** [GET/POST/PUT/DELETE]
**Шлях:** `/api/[назва]`
**Опис:** [Опис функціональності]

## Вимоги:

🔴 **Контур (0.4.1):** вітрина ходить у БД лише через `withActor()`
з `simplycms/db` (Drizzle поверх Postgres) і авторизується Better Auth
(`readSessionSubject()` з `simplycms/auth`) — Supabase зі шляху вітрини
знято повністю. Субшляху `simplycms/data-supabase` НЕ ІСНУЄ. Клієнти
`simplycms/supabase/*` лишаються лише для адмінки (до треку К3) — застосовуй
їх ТІЛЬКИ якщо роут явно адмінський.

1. **Авторизація та безпека**
   - Перевір сесію через `readSessionSubject(request.headers)` з `simplycms/auth`
   - Реалізуй перевірку ролей якщо потрібно (`subject.roles`)
   - Валідуй вхідні дані через Zod

2. **Обробка даних**
   - Використовуй TypeScript типи для request/response
   - Додай валідацію з Zod
   - Реалізуй правильну обробку помилок

3. **База даних**
   - Працюй через `withActor({ role }, (db) => …)` з `simplycms/db` (Drizzle)
   - Видимість фільтрує КОД (явний предикат `is_active`/`has_page`), не RLS —
     каталог RLS не має (модель B5″)
   - Поверни структуровані дані

4. **Відповіді та статуси**
   - Правильні HTTP статус коди
   - Консистентний формат відповідей
   - Зрозумілі повідомлення про помилки українською

## Структура відповіді:

```typescript
// Успішна відповідь
{ data: T, message?: string }

// Помилка
{ error: string, code?: string }
```

## Шаблон:

```typescript
// app/api/[name]/route.ts
import { createServerSupabase } from 'simplycms/supabase/server-client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  // ...
}
```

## Перевір через MCP:
- **context7:** TanStack Start server routes API
- **supabase:** RLS policies для нових таблиць
