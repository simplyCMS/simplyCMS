import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
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
// `entity_id` — nullable: файл може бути завантажений ДО привʼязки (медіатека).
// Перехід NULL → значення теж вимагає `UPDATE`, тобто ролі `app_admin`, тобто
// явної серверної операції — саме те, чого вимагає спека («перепривʼязка —
// лише авторизованою серверною операцією»).
//
// RLS не вмикається: `media` не входить до user-scoped списку B5″ (файли
// належать магазину, не покупцю), доступ визначають гранти.
export const media = pgTable(
  'media',
  {
    id: uuid().primaryKey().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    storageKey: text('storage_key').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
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
