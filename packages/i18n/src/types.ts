import type { messages as ukMessages } from './catalogs/uk';

/** Підтримувані локалі ядра. */
export type Locale = 'uk' | 'en';

/**
 * Ключі повідомлень. Виводяться з українського каталогу — він повний, решта
 * каталогів часткові, тож `keyof` саме uk дає замкнений і чесний union.
 */
export type MessageKey = keyof typeof ukMessages;

/** Каталог перекладів: неповний за визначенням — решту добирає fallback на uk. */
export type Catalog = Partial<Record<MessageKey, string>>;

/** Параметри підстановки у плейсхолдери `{name}`. */
export type MessageParams = Record<string, string | number>;

/** Транслятор — чиста функція, створена під конкретну локаль. */
export type Translator = (key: MessageKey, params?: MessageParams) => string;
