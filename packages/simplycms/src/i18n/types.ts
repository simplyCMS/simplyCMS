import type { messages as ukBase } from './catalogs/uk/base';
import type { messages as ukAdmin } from './catalogs/uk/admin/index';
import type { messages as ukMail } from './catalogs/uk/mail';

/** Частина каталогу ядра: вантажиться окремо, лише де потрібна (вітрина — `base`). */
export type UiCatalogPart = 'base' | 'admin' | 'mail';

/**
 * Ключі частин виводяться з українських каталогів — вони повні, тож `keyof` саме uk дає
 * замкнений і чесний union. Англійські частини `satisfies Record<…Key, string>`.
 */
export type BaseKey = keyof typeof ukBase;
export type AdminKey = keyof typeof ukAdmin;
export type MailKey = keyof typeof ukMail;
export type MessageKey = BaseKey | AdminKey | MailKey;

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
