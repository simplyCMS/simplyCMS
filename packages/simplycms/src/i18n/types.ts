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

/**
 * Завантажена частина каталогу. Тип значення Task 7 розширить до `string | PluralForms`;
 * разом із ним зміниться й `lookupMessage`.
 */
export type PartCatalog = Readonly<Record<string, string>>;

/**
 * Мовний пакет ядра. Вісь інтерфейсу (`ui`) і вісь контенту (`content`) — окремі частини
 * (спека §19): мова може мати лише одну з них. `ui` — ЛІНИВІ лоадери частин каталогу, щоб
 * початковий граф вітрини не тягнув текст адмінки й листів (І43); розбір лоадерів — лише
 * через реєстр `loadUiCatalog`, який кешує проміс.
 */
export interface LanguagePack {
  readonly code: string;
  readonly name: string;
  /** `base` і `mail` обов'язкові (мову без них не опублікувати, §19.15); `admin` — ні. */
  readonly ui: {
    readonly base: () => Promise<PartCatalog>;
    readonly mail: () => Promise<PartCatalog>;
    readonly admin?: () => Promise<PartCatalog>;
  };
  readonly content: {
    /** Транслітерація для slug; без неї нелатинський текст `slugify` не передасть. */
    readonly slugify?: (text: string) => string;
    /** Місце під токенізацію пошуку наступної хвилі — поки порожнє за типом. */
    readonly tokenize?: never;
  };
}

/** Параметри підстановки у плейсхолдери `{name}`. */
export type MessageParams = Record<string, string | number>;

/** Транслятор — чиста функція, створена під конкретну локаль. */
export type Translator = (key: MessageKey, params?: MessageParams) => string;
