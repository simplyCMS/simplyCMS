import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Outbox пошти (Е8-Р10). Лист ставиться в чергу в ТІЙ САМІЙ транзакції, що й
// подія, яка його породила (замовлення, запрошення), а надсилається другою
// фазою ПІСЛЯ COMMIT: недоступний SMTP не мусить валити замовлення, а
// відкат не мусить лишати надісланий лист. Повтор — як у `media_erasures`:
// добір хвостів при наступній доставці й кнопка в адмінці, таймера немає.
//
// 🔴 Категорія A: `id` задає викликач, `DEFAULT gen_random_uuid()` немає.
// 🔴 `message` містить тіло листа, а тіло листа скидання пароля — секрет
// (посилання з токеном). Тому гранти лише `app_admin`, а адмінська картка
// хвостів читає колонки БЕЗ `message` (`listMailOutbox`).
export const mailOutbox = pgTable(
  'mail_outbox',
  {
    id: uuid().primaryKey().notNull(),
    kind: text().notNull(),
    message: jsonb().notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    attempts: integer().default(0).notNull(),
    lastError: text('last_error'),
  },
  () => [
    pgPolicy('mail_outbox_admin_all', {
      as: 'permissive',
      for: 'all',
      to: ['app_admin'],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
