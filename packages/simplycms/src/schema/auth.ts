import {
  boolean,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Канонічні таблиці Better Auth у схемі `public` — рішення B3′ (амендмент
// 2026-08-23). Схема GoTrue `auth.users` зникає як клас: ці таблиці стають
// єдиним джерелом ідентичності, і саме на `users.id` дивляться FK шести
// доменних таблиць `schema.ts`.
//
// 🔴 PK — `uuid`, а не канонічний для BA `text`: FK-колонки шести доменних
// таблиць уже `uuid`, і зміна їхнього типу розповзлася б по всій схемі,
// типах і запитах. Генерацію id віддано БД (`defaultRandom()`) — інстанс BA
// у Task 7 мусить вимкнути власний генератор.
//
// 🔴 Імена таблиць — у МНОЖИНІ (доменна схема вся така), а BA за
// замовчуванням очікує однину; тому адаптер у Task 7 зобовʼязаний піти з
// `usePlural: true`.
//
// 🔴 Склад полів звірено з better-auth@1.7.1 (`@better-auth/core`,
// `getAuthTables`) станом на 2026-08-23 — звідси `accounts.issuer` і
// унікальність `(issuer, account_id)`, яких немає в старіших описах BA.
// Звірка з РАНТАЙМОМ (інстанс BA проти цієї схеми) — Task 7: там версія
// стає залежністю пакета, і розбіжність падає тестом, а не в проді.
//
// `mode: 'date'` (доменна схема вживає `'string'`): адаптер BA передає в
// драйвер обʼєкти `Date` і чекає `Date` назад.
//
// RLS тут НЕ вмикається: auth-таблиці не входять до user-scoped списку B5″,
// а доступ до них має лише серверний auth-контур — це вирішується грантами
// (Task 4), не політиками.

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('users_email_key').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    token: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'sessions_user_id_fkey',
    }).onDelete('cascade'),
    unique('sessions_token_key').on(table.token),
    index('idx_sessions_user_id').on(table.userId),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    issuer: text().notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'accounts_user_id_fkey',
    }).onDelete('cascade'),
    uniqueIndex('accounts_issuer_account_id_key').on(
      table.issuer,
      table.accountId,
    ),
    index('idx_accounts_user_id').on(table.userId),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  // BA шукає запис за `identifier` на кожній верифікації пошти/reset-у —
  // індекс не «про всяк випадок», а під єдиний спосіб читання цієї таблиці.
  (table) => [index('idx_verifications_identifier').on(table.identifier)],
);
