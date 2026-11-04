import type { messages as ukMessages } from './catalogs/uk/index';

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
