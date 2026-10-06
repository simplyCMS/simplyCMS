// Контракт профілю магазину (Е6б-6): рядок `system_settings['store_profile']`.
// T0 — лише типи й константи, без Zod: схему запису будує сервер
// (`admin-server/impl`), читачі розбирають jsonb поблажливим type-guard-ом
// з `simplycms/domain/store-profile`.

/** Ключ рядка профілю в `system_settings`. */
export const STORE_PROFILE_KEY = 'store_profile';

/** Ключ налаштувань обліку залишків у `system_settings`. */
export const STOCK_MANAGEMENT_KEY = 'stock_management';

/** Підтримувані соцмережі; порядок — порядок у формі адмінки. */
export const SOCIAL_NETWORKS = [
  'instagram',
  'facebook',
  'telegram',
  'tiktok',
  'youtube',
  'x',
  'viber',
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type StoreProfile = {
  /** Обовʼязкове, ≤ 120. */
  name: string;
  /** `<title>` головної; `null` → `name`. */
  homeTitle: string | null;
  /** Meta description за замовчуванням, ≤ 300. */
  description: string | null;
  contacts: {
    phone: string | null;
    email: string | null;
    address: string | null;
    /** Вільний текст на кшталт «Пн–Пт 9–18». */
    hours: string | null;
  };
  /** Референс порту сховища (`media.storage_key`), не URL. */
  logo: string | null;
  /** ≤ 10 елементів, url — лише `https:`. */
  socials: { network: SocialNetwork; url: string }[];
};

/** Профіль у вітрині: референс логотипа вже розвʼязано в URL. */
export type StorefrontProfile = Omit<StoreProfile, 'logo'> & {
  logoUrl: string | null;
};

/**
 * Межі довжин. Живуть у T0, бо потрібні обом бокам: сервер валідує запис,
 * форма адмінки показує ті самі `maxLength`, а парсер читання обрізає по них.
 */
export const STORE_PROFILE_LIMITS = {
  name: 120,
  homeTitle: 120,
  description: 300,
  phone: 40,
  email: 254,
  address: 300,
  hours: 120,
  socials: 10,
  socialUrl: 500,
} as const;
