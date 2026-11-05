import type { messages as ukBase } from './catalogs/uk/base';
import type { messages as ukAdmin } from './catalogs/uk/admin/index';
import type { messages as ukMail } from './catalogs/uk/mail';
import type { UiLocale } from 'simplycms/contracts';
import type { SeedOrderStatusCode } from 'simplycms/schema/seed-ids';

/** Частина каталогу ядра: вантажиться окремо, лише де потрібна (вітрина — `base`). */
export type UiCatalogPart = 'base' | 'admin' | 'mail';

/**
 * Категорії множини CLDR. Набір категорій мови — `Intl.PluralRules(code)
 * .resolvedOptions().pluralCategories`: `uk` — one/few/many/other, `en` — one/other,
 * `ar` — усі шість.
 */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Значення-множина: форми за категоріями CLDR. `other` обов'язкова (кінцева ланка вибору),
 * решту оголошує мова. `{count}` у формах підставляє `plural` сам.
 */
export type PluralForms = { readonly other: string } & Partial<
  Readonly<Record<Exclude<PluralCategory, 'other'>, string>>
>;

/** Значення ключа каталогу: рядок або форми множини (один ключ — усі форми, спека §19). */
export type CatalogValue = string | PluralForms;

/**
 * Ключі виводяться з українських каталогів — вони повні, тож `keyof` саме uk дає
 * замкнений і чесний union. Англійські частини `satisfies` форму `ShapeOf` uk-частини.
 */
type KeysWith<C, V> = {
  [K in keyof C]-?: C[K] extends V ? K : never;
}[keyof C] &
  string;

/** Ключі каталогу `C` зі значенням-рядком (їх приймає `t()`). */
export type StringKeyOf<C> = KeysWith<C, string>;
/** Ключі каталогу `C` зі значенням-формами множини (їх приймає лише `plural`). */
export type PluralKeyOf<C> = KeysWith<C, PluralForms>;
/** Форма значень каталогу `C` для його перекладу: рядок лишається рядком, форми — формами. */
export type ShapeOf<C> = {
  [K in keyof C]: C[K] extends string ? string : PluralForms;
};

export type BaseKey = keyof typeof ukBase;
export type AdminKey = keyof typeof ukAdmin;
export type MailKey = keyof typeof ukMail;
export type MessageKey =
  | StringKeyOf<typeof ukBase>
  | StringKeyOf<typeof ukAdmin>
  | StringKeyOf<typeof ukMail>;
/** Ключі множини ядра: їх приймає лише `plural`. */
export type PluralKey =
  | PluralKeyOf<typeof ukBase>
  | PluralKeyOf<typeof ukAdmin>
  | PluralKeyOf<typeof ukMail>;
/** Завантажена частина каталогу. */
export type PartCatalog = Readonly<Record<string, CatalogValue>>;

/**
 * Тексти довідників чистого магазину мовою пакета: їх вставляє `bootstrapStore`
 * (`simplycms/migrate`) на старті БД, коли мова є основною. Коди й id — у
 * `simplycms/schema` (`SYSTEM_SEED_IDS`), тут лише рядки.
 */
export type SeedTexts = {
  readonly orderStatuses: Readonly<Record<SeedOrderStatusCode, string>>;
  readonly priceTypeRetail: string;
  readonly customerCategoryRetail: string;
  readonly mainShippingZone: string;
  /** Назва магазину в `store_profile` до першого збереження профілю власником. */
  readonly storeName: string;
};

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
    /** Тексти довідників для старту БД з цією мовою основною; обов'язкові. */
    readonly seed: SeedTexts;
    /** Транслітерація для slug; без неї нелатинський текст `slugify` не передасть. */
    readonly slugify?: (text: string) => string;
    /** Місце під токенізацію пошуку наступної хвилі — поки порожнє за типом. */
    readonly tokenize?: never;
  };
}

/** Параметри підстановки у плейсхолдери `{name}`. */
export type MessageParams = Record<string, string | number>;

/**
 * Форми множини разом з МОВОЮ каталогу, де їх знайдено: категорію `plural` вибирає за
 * правилами цієї мови, а не мови інтерфейсу. Форми з fallback-каталогу (тема лише з `uk`,
 * інтерфейс `en`) інакше дали б «5 товару» — правила англійської до українських слів.
 */
export interface FoundForms {
  readonly forms: PluralForms;
  readonly locale: UiLocale;
}

/** Те, що потрібно `plural`: доступ до форм ключа разом з мовою їхнього каталогу. */
export interface PluralSource<P extends string = PluralKey> {
  /** Форми ключа з першого каталогу ланцюга, де він є формами; ключа-множини немає — `undefined`. */
  readonly forms: (key: P) => FoundForms | undefined;
}

/**
 * Транслятор — чиста функція під конкретну локаль + доступ до форм множини. Один контракт
 * для ядра, тем і плагінів: `S` — рядкові ключі, `P` — ключі множини (для ядра виводяться з
 * `uk`, для теми й плагіна — з їхнього каталогу).
 */
export interface PluralTranslator<
  S extends string = MessageKey,
  P extends string = PluralKey,
> extends PluralSource<P> {
  (key: S, params?: MessageParams): string;
}

/** Транслятор ядра. */
export type Translator = PluralTranslator;
