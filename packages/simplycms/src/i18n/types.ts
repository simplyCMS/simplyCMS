import type { messages as ukMessages } from './catalogs/uk/index';

/**
 * Код мови — рядок BCP 47 (`uk`, `pt-BR`). Тип відкритий: мови додає власник
 * магазину в адмінці, а не ядро на етапі збірки. Мови, для якої немає
 * `LanguagePack`, транслятор обслуговує фолбеком — основною мовою магазину.
 */
export type Locale = string;

/**
 * Набір мов магазину в розрізі запиту. Єдина форма для сервера (кеш мов з
 * поколіннями), клієнта (`window.__SCMS_LOCALES__`) і розбору URL.
 *
 * `published` містить і основну (вона завжди опублікована); `known` — усі мови
 * в БД, зокрема чернетки й вимкнені: лише так сервер відрізняє «мову, якої
 * немає» (сегмент — звичайний шлях) від «мови, що ще не опублікована» (404).
 */
export type LocaleSet = {
  readonly primary: Locale;
  readonly published: readonly Locale[];
  readonly known: readonly Locale[];
};

/**
 * Ключі повідомлень. Виводяться з українського каталогу — він повний, решта
 * каталогів часткові, тож `keyof` саме uk дає замкнений і чесний union.
 */
export type MessageKey = keyof typeof ukMessages;

/** Каталог перекладів: неповний за визначенням — решту добирає fallback-мова. */
export type Catalog = Partial<Record<MessageKey, string>>;

/**
 * Мовний пакет ядра: каталог інтерфейсу і (необов'язково) таблиця для адрес.
 * Мова без пакета не помилка: її адреси вимагають ручного вводу, а інтерфейс
 * іде фолбеком.
 */
export interface LanguagePack {
  readonly code: string;
  readonly name: string;
  readonly catalog: Catalog;
  /** Транслітерація для slug; без неї нелатинський текст `slugify` не передасть. */
  readonly slugify?: (text: string) => string;
  /** Місце під токенізацію пошуку наступної хвилі — поки порожнє за типом. */
  readonly tokenize?: never;
}

/** Параметри підстановки у плейсхолдери `{name}`. */
export type MessageParams = Record<string, string | number>;

/** Транслятор — чиста функція, створена під конкретну локаль. */
export type Translator = (key: MessageKey, params?: MessageParams) => string;
