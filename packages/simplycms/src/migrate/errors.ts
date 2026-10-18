/**
 * Помилки накату міграцій. Окремі класи, а не рядки: старт контейнера,
 * `db:apply` і `doctor` реагують на них по-різному (код виходу, підказка), і
 * розрізняти їх за текстом повідомлення було б крихко.
 *
 * 🔴 Жоден текст тут не містить рядка підключення чи пароля: помилка накату
 * друкується в лог деплою.
 */

import { isCoreMigrationName } from './core-name';

/**
 * Файл, уже записаний у журнал, змінився. Накат не починається взагалі —
 * навіть нові файли поруч не котяться: продовжувати поверх розбіжності
 * означало б вгадувати, яка зі схем справжня.
 *
 * Дія залежить від того, чий файл змінився. Файл ядра (`NNNN_`) — це правка
 * baseline: до 1.0 його правлять як виняток, а базу створюють заново (інакше
 * стара схема лишилась би під новим файлом). Чужий файл (плагін, магазин) —
 * застосований файл не правиться, зміна йде новою міграцією.
 */
export class MigrationChecksumError extends Error {
  readonly names: readonly string[];

  constructor(names: readonly string[]) {
    const core = names.filter(isCoreMigrationName);
    const own = names.filter((name) => !isCoreMigrationName(name));
    const parts: string[] = [];
    if (core.length > 0)
      parts.push(
        `baseline платформи змінився: ${core.join(', ')} (до 1.0 базу створюють ` +
          'заново: локально — порожня локальна БД і `pnpm simplycms db:apply` (у монорепо ' +
          'платформи `db:demo`), на сервері — новий порожній екземпляр БД).',
      );
    if (own.length > 0)
      parts.push(
        `Змінено вже накочені міграції: ${own.join(', ')}. Застосований файл не ` +
          'правиться — поверніть його вміст і внесіть зміну новою міграцією.',
      );
    super(`[simplycms/migrate] ${parts.join(' ')}`);
    this.name = 'MigrationChecksumError';
    this.names = names;
  }
}

/**
 * У базі є схема магазину, але немає журналу. Що з канону в ній реально
 * лежить, невідомо, тож будь-який накат — вгадування; адопцію таких баз
 * свідомо не підтримуємо.
 */
export class UnjournaledDatabaseError extends Error {
  constructor() {
    super(
      '[simplycms/migrate] База містить таблиці магазину, але не має журналу ' +
        'міграцій (public.simplycms_migrations): перестворіть базу порожньою — ' +
        'міграції накотяться на неї зі старту застосунку або `simplycms db:apply`; ' +
        'адопція бази без журналу не підтримується.',
    );
    this.name = 'UnjournaledDatabaseError';
  }
}

/** Причина, з якої файл міграції не можна виконати в транзакції накату. */
export type TransactionControlReason = 'concurrently' | 'begin' | 'commit';

const REASON_TEXT: Record<TransactionControlReason, string> = {
  concurrently: '`concurrently` не виконується всередині транзакції.',
  begin: 'власний `begin` відкриває транзакцію поверх транзакції накату.',
  commit: 'власний `commit`/`rollback` розриває атомарність накату файлу.',
};

/**
 * Файл міграції керує транзакцією сам (`begin`/`commit`) або містить
 * `concurrently`, що в транзакції не виконується. Накат загортає КОЖЕН файл
 * у власну транзакцію разом із записом журналу — інакше частково накочений
 * файл лишився б без запису й повторний старт котив би його вдруге.
 */
export class MigrationTransactionControlError extends Error {
  readonly file: string;
  readonly reason: TransactionControlReason;

  constructor(file: string, reason: TransactionControlReason) {
    super(
      `[simplycms/migrate] ${file}: ${REASON_TEXT[reason]} Файл міграції ` +
        'виконується в одній транзакції накату; індекс на великій таблиці — ' +
        'окреме рішення, а не частина міграції.',
    );
    this.name = 'MigrationTransactionControlError';
    this.file = file;
    this.reason = reason;
  }
}

/**
 * Підказка до помилки накату з кодом `42501` (брак права). Прелюдія створює ролі `app_*` і
 * задає їм атрибути `nosuperuser`/`nobypassrls`, а їх Postgres дозволяє міняти лише
 * суперкористувачу, тож найчастіша причина — роль накату без SUPERUSER.
 */
export const SUPERUSER_HINT =
  '; ймовірна причина — роль накату (MIGRATION_DATABASE_URL) не SUPERUSER кластера (вимога: ' +
  'SUPERUSER; керовані Postgres лише з CREATEROLE не підтримуються, docs/development/ENVIRONMENT.md); ' +
  'якщо роль — суперкористувач, причина в грантах міграції';
