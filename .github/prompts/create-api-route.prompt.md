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

1. **Авторизація та безпека**
   - Перевір авторизацію через `createServerSupabase()` з `@simplysoftua/core`
   - Реалізуй перевірку ролей якщо потрібно (user_roles)
   - Валідуй вхідні дані через Zod

2. **Обробка даних**
   - Використовуй TypeScript типи для request/response
   - Додай валідацію з Zod
   - Реалізуй правильну обробку помилок

3. **База даних**
   - Працюй через Supabase клієнт з `@simplysoftua/core/supabase/server`
   - RLS policies для авторизації на рівні бази
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
import { createServerSupabase } from '@simplysoftua/core/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  // ...
}
```

## Перевір через MCP:
- **context7:** TanStack Start server routes API
- **supabase:** RLS policies для нових таблиць
