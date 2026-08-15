import type { ThemeMessages } from '@simplycms/themes/types';

/**
 * Каталог перекладів теми (`ThemeModule.messages`, контракт v2).
 *
 * Сюди йде ЛИШЕ текст, унікальний для цієї теми (бренд, копірайт, власні
 * розділи підвалу). Рядки, що вже є в ядрі (`catalog.title`, `cart.title`,
 * `nav.orders`, …), компоненти беруть через `useT()` напряму — дублювати їх
 * тут не треба. `en` дзеркалить `uk` 1:1.
 */
export const messages = {
  uk: {
    'theme.brand': 'Deo',
    'theme.nav.catalog': 'Каталог',
    'theme.nav.cart': 'Кошик',
    'theme.footer.tagline': 'Магазин на SimplyCMS',
    'theme.footer.copyright': '© {year} Deo',
  },
  en: {
    'theme.brand': 'Deo',
    'theme.nav.catalog': 'Catalog',
    'theme.nav.cart': 'Cart',
    'theme.footer.tagline': 'A SimplyCMS storefront',
    'theme.footer.copyright': '© {year} Deo',
  },
} satisfies ThemeMessages;

/** Локальний union ключів — перевірка одруків у межах власного каталогу. */
export type ThemeKey = keyof typeof messages.uk;
