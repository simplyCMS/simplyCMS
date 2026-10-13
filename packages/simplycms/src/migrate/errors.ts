/**
 * Помилки накату міграцій. Окремі класи, а не рядки: старт контейнера,
 * `db:apply` і `doctor` реагують на них по-різному (код виходу, підказка), і
 * розрізняти їх за текстом повідомлення було б крихко.
 *
 * 🔴 Жоден текст тут не містить рядка підключення чи пароля: помилка накату
 * друкується в лог деплою.
 */

/**
 * Файл, уже записаний у журнал, змінився. Накат не починається взагалі —
 * навіть нові файли поруч не котяться: застосований файл правити не можна
 * (схема змінюється лише новою міграцією), і продовжувати поверх
 * розбіжності означало б вгадувати, яка зі схем справжня.
 */
export class MigrationChecksumError extends Error {
  readonly names: readonly string[];

  constructor(names: readonly string[]) {
    super(
      `[simplycms/migrate] Змінено вже накочені міграції: ${names.join(', ')}. ` +
        'Застосований файл не правиться — поверніть його вміст і внесіть зміну ' +
        'новою міграцією.',
    );
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
