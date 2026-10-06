import type { ThemeMessages } from 'simplycms/themes/types';

/**
 * Каталог перекладів теми (`ThemeModule.messages`, контракт v2).
 *
 * Сюди йде ЛИШЕ текст, унікальний для цієї теми (копірайт, власні розділи
 * підвалу). Назви магазину тут немає: її дає профіль (`useStoreProfile()`),
 * бо назва теми — не бренд магазину. Рядки, що вже є в ядрі (`catalog.title`, `cart.title`,
 * `nav.orders`, …), компоненти беруть через `useT()` напряму — дублювати їх
 * тут не треба. `en` дзеркалить `uk` 1:1.
 */
export const messages = {
  uk: {
    'theme.nav.catalog': 'Каталог',
    'theme.nav.cart': 'Кошик',
    'theme.footer.tagline': 'Магазин на SimplyCMS',
    'theme.footer.copyright': '© {year} {name}',
  },
  en: {
    'theme.nav.catalog': 'Catalog',
    'theme.nav.cart': 'Cart',
    'theme.footer.tagline': 'A SimplyCMS storefront',
    'theme.footer.copyright': '© {year} {name}',
  },
} satisfies ThemeMessages;

/** Локальний union ключів — перевірка одруків у межах власного каталогу. */
export type ThemeKey = keyof typeof messages.uk;
