import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';

// Метадані медіа — таблиця народжується разом зі схемою v2, хоч сам
// storage-порт приземляється в К4. Причина в спеці (§4-К4): облік обсягу й
// незмінність власності — це ІНВАРІАНТИ порту, а інваріанти не доліплюються
// після того, як драйвери вже пишуть файли.
//
// `size_bytes` пишеться в тій самій транзакції, що й видача presigned-upload:
// у S3-порту тригера на обʼєкти немає, тож інакше хмарні тарифи з лімітами
// сховища нема чим рахувати (cloud-спека C11).
//
// 🔴 Незмінність колонок власності (`entity_type`/`entity_id`/`storage_key`/
// `uploaded_by`) реалізована ФАКТОМ ДИЗАЙНУ, а не тригером: `app_user` не
// отримує `UPDATE` на цій таблиці взагалі (гранти — Task 4), тож перепривʼязка
// чужого файлу до своєї сутності неможлива за відсутністю права, а не за
// перевіркою в тілі тригера. Тригер тут був би гіршим із трьох причин:
// (1) plpgsql-логіка в БД — рівно той клас, який B5″ виводить зі схеми;
// (2) drizzle-kit тригерів не емітить, тож інваріант став би невидимим для
// baseline; (3) право `UPDATE` лишалося б виданим — а це і є вектор атаки,
// знайдений аудитом MetaHub. Стережеться поведінковим тестом у Task 5.
//
// `entity_id` — NOT NULL (К3-Е6д-4): кожен записувач передає власника, а
// двофазне стирання й перевірка видимості при роздачі спираються на нього.
// Рядок без власника був би невидимим для обох. Перепривʼязка — лише
// авторизованою серверною операцією (`UPDATE` має лише `app_admin`).
//
// RLS не вмикається: `media` не входить до user-scoped списку B5″ (файли
// належать магазину, не покупцю), доступ визначають гранти.
export const media = pgTable(
  'media',
  {
    id: uuid().primaryKey().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    storageKey: text('storage_key').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
      name: 'media_uploaded_by_fkey',
    }).onDelete('set null'),
    // Ключ у сховищі — природний унікальний ідентифікатор файлу; дубль
    // означав би подвійний облік байтів того самого обʼєкта.
    unique('media_storage_key_key').on(table.storageKey),
    index('idx_media_entity').on(table.entityType, table.entityId),
    index('idx_media_uploaded_by').on(table.uploadedBy),
    check('media_size_bytes_non_negative', sql`size_bytes >= 0`),
  ],
);

// Outbox стирання файлів (Е6д-20). Рядок `media` видаляє транзакція, файл —
// друга фаза ПІСЛЯ COMMIT; між ними процес може впасти або `driver.delete`
// може кинути. Без цього таблиця «стерті рядки з живими файлами» не мала б
// сліду — орфан бачив би лише sweep. Рядок outbox ставиться в ТІЙ САМІЙ
// транзакції, що й `DELETE media`, тож відкат прибирає обидва разом.
//
// 🔴 Категорія A: `id` задає викликач, `DEFAULT gen_random_uuid()` немає.
// 🔴 Гранти лише `app_admin`: покупець не бачить чужих ключів файлів, а
// ескалація `operator` — це `set local role app_admin` у транзакції покупця
// (`storefront/loaders/escalation.ts`), окремої DB-ролі немає.
export const mediaErasures = pgTable(
  'media_erasures',
  {
    id: uuid().primaryKey().notNull(),
    storageKey: text('storage_key').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    attempts: integer().default(0).notNull(),
    lastError: text('last_error'),
  },
  (table) => [
    // Один хвіст на ключ: повторна вставка (`on conflict do nothing`) не
    // плодить дублів, а `attempts` рахує спроби саме цього файлу.
    unique('media_erasures_storage_key_key').on(table.storageKey),
    pgPolicy('media_erasures_admin_all', {
      as: 'permissive',
      for: 'all',
      to: ['app_admin'],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
