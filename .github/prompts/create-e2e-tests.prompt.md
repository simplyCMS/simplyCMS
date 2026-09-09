---
description: "Написання E2E тестів для SimplyCMS"
---

# Написання E2E тестів

Створи E2E тести для функціональності SimplyCMS:

## Інформація про тестування:

**Функціональність:** [Опис що тестуємо]
**Сторінка/Компонент:** [Шлях або назва]
**Користувацький сценарій:** [Опис user journey]

## Вимоги до тестів:

1. **Структура тестів**
   - Використовуй Vitest + Testing Library
   - Групуй тести в `describe` блоки
   - Назви тестів українською мовою
   - Слідуй AAA паттерну (Arrange, Act, Assert)

2. **Селектори**
   - Використовуй `data-testid` атрибути
   - Використовуй `getByRole`, `getByText` з Testing Library
   - Уникай CSS селекторів що можуть змінитися

3. **Тестові дані**
   - Створюй чисті тестові дані
   - Мокай Supabase клієнт для unit тестів
   - Використовуй фікстури для складних об'єктів

4. **Сценарії тестування**
   - Happy path (основний успішний сценарій)
   - Edge cases (граничні випадки)
   - Error handling (обробка помилок)
   - Empty states
   - Loading states

## Включи тести для:

- [ ] Компонентів (render, user interactions)
- [ ] Хуків (useCart, usePriceType, etc.)
- [ ] Форм та валідації (Zod schemas)
- [ ] Бізнес-логіки (discountEngine, shipping)
- [ ] Error states
- [ ] Loading states

## Приклад структури:

```typescript
// __tests__/ProductCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('ProductCard', () => {
  it('відображає назву товару', () => {
    // Arrange, Act, Assert
  });
});
```
