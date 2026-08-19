import type { ThemeMessages } from '@simplycms/themes/types';

/**
 * Каталог перекладів теми (`ThemeModule.messages`, контракт v2).
 *
 * Тут ЛИШЕ текст, унікальний для цієї теми. Рядки, що вже є в ядрі
 * (`catalog.title`, `cart.title`, `nav.orders`, `nav.profile`,
 * `nav.settings`, `nav.signOut`, `auth.login.submit`, `common.error`),
 * компоненти беруть через `useT()` — дублювати їх сюди не можна.
 *
 * 🔴 `theme.brand` — назва НАШОГО магазину, а не бренд референс-сайту,
 * з якого знято дизайн: бренд на вітрині бачить покупець, і чужий бренд
 * там — це імперсонація (правові межі фази 0 скіла redesign-from-reference).
 * Власник магазину міняє рядок тут, не чіпаючи компонентів.
 */
export const messages = {
  uk: {
    'theme.brand': 'SimplyCMS Store',
    'theme.nav.home': 'Головна',
    'theme.header.search': 'Пошук у каталозі',
    'theme.header.account': 'Мій акаунт',
    'theme.header.menu': 'Меню',
    'theme.header.myAccount': 'Мій акаунт',
    'theme.header.adminPanel': 'Адмінпанель',
    'theme.header.signedOut': 'Ви вийшли з акаунта',
    'theme.header.signOutError': 'Не вдалося вийти. Спробуйте ще раз.',

    'theme.hero.badge': 'Нові надходження щотижня',
    'theme.hero.titleLine1': 'Виважений вибір',
    'theme.hero.titleLine2': 'для кожного дня.',
    'theme.hero.subtitle':
      'Добірка перевірених товарів — від щоденних дрібниць до речей, заради яких варто повертатись.',
    'theme.hero.ctaPrimary': 'До каталогу',
    'theme.hero.ctaSecondary': 'Що нового',
    'theme.hero.trustAuthentic': 'Тільки оригінал',
    'theme.hero.trustAuthenticNote': 'Перевірено вручну',
    'theme.hero.trustReturns': 'Прості повернення',
    'theme.hero.trustReturnsNote': '14 днів без пояснень',
    'theme.hero.trustShipping': 'Швидка доставка',
    'theme.hero.trustShippingNote': 'З відстеженням',

    'theme.footer.tagline': 'Магазин на SimplyCMS для тих, хто цінує деталі.',
    'theme.footer.copyright': '© {year} SimplyCMS Store',
    'theme.footer.colShop': 'Магазин',
    'theme.footer.colAccount': 'Акаунт',
    'theme.footer.colStore': 'Сервіс',
    'theme.footer.linkHome': 'Головна',
    'theme.footer.linkCheckout': 'Оформлення',
    'theme.footer.socialFeed': 'Стрічка новин',
    'theme.footer.socialCommunity': 'Спільнота',
    'theme.footer.socialContact': 'Звʼязатися з нами',

    'theme.newsletter.label': 'Будьте в курсі',
    'theme.newsletter.heading': 'Приєднуйтесь до розсилки',
    'theme.newsletter.subtitle':
      'Розповідаємо про нові надходження й закриті пропозиції. Без спаму.',
    'theme.newsletter.placeholder': 'Ваш e-mail',
    'theme.newsletter.submit': 'Підписатись',
    'theme.newsletter.thanksTitle': 'Дякуємо за підписку',
    'theme.newsletter.thanksDescription':
      'Ми надішлемо листа, щойно зʼявиться щось варте уваги.',

    // View-шар контракту v3 (картка товару й каталог). Рядки, що вже є в
    // ядрі (`catalog.title`, `product.description`, `product.sku`…), беруться
    // через `useT()` — дублювати їх сюди не можна.
    'theme.view.back': 'Назад до каталогу',
    'theme.view.noImage': 'Фото немає',
    'theme.view.photo': 'Фото {number}',

    'theme.product.trustAuthentic': 'Тільки оригінал',
    'theme.product.trustAuthenticNote': 'Перевірено вручну',
    'theme.product.trustShipping': 'Швидка доставка',
    'theme.product.trustShippingNote': 'З відстеженням',
    'theme.product.trustReturns': 'Прості повернення',
    'theme.product.trustReturnsNote': '14 днів без пояснень',
  },
  en: {
    'theme.brand': 'SimplyCMS Store',
    'theme.nav.home': 'Home',
    'theme.header.search': 'Search the catalog',
    'theme.header.account': 'My account',
    'theme.header.menu': 'Menu',
    'theme.header.myAccount': 'My account',
    'theme.header.adminPanel': 'Admin panel',
    'theme.header.signedOut': 'You have signed out',
    'theme.header.signOutError': 'Could not sign out. Please try again.',

    'theme.hero.badge': 'New arrivals every week',
    'theme.hero.titleLine1': 'A considered choice',
    'theme.hero.titleLine2': 'for every day.',
    'theme.hero.subtitle':
      'A curated range of trusted goods — from everyday essentials to the pieces worth coming back for.',
    'theme.hero.ctaPrimary': 'Browse catalog',
    'theme.hero.ctaSecondary': "What's new",
    'theme.hero.trustAuthentic': 'Genuine only',
    'theme.hero.trustAuthenticNote': 'Checked by hand',
    'theme.hero.trustReturns': 'Easy returns',
    'theme.hero.trustReturnsNote': '14 days, no questions',
    'theme.hero.trustShipping': 'Fast shipping',
    'theme.hero.trustShippingNote': 'Tracked end to end',

    'theme.footer.tagline':
      'A SimplyCMS storefront for people who like details.',
    'theme.footer.copyright': '© {year} SimplyCMS Store',
    'theme.footer.colShop': 'Shop',
    'theme.footer.colAccount': 'Account',
    'theme.footer.colStore': 'Service',
    'theme.footer.linkHome': 'Home',
    'theme.footer.linkCheckout': 'Checkout',
    'theme.footer.socialFeed': 'News feed',
    'theme.footer.socialCommunity': 'Community',
    'theme.footer.socialContact': 'Contact us',

    'theme.newsletter.label': 'Stay updated',
    'theme.newsletter.heading': 'Join the mailing list',
    'theme.newsletter.subtitle':
      'News about fresh arrivals and members-only offers. No spam.',
    'theme.newsletter.placeholder': 'Your email',
    'theme.newsletter.submit': 'Subscribe',
    'theme.newsletter.thanksTitle': 'Thanks for subscribing',
    'theme.newsletter.thanksDescription':
      'We will write as soon as there is something worth your time.',

    'theme.view.back': 'Back to catalog',
    'theme.view.noImage': 'No photo',
    'theme.view.photo': 'Photo {number}',

    'theme.product.trustAuthentic': 'Genuine only',
    'theme.product.trustAuthenticNote': 'Checked by hand',
    'theme.product.trustShipping': 'Fast delivery',
    'theme.product.trustShippingNote': 'With tracking',
    'theme.product.trustReturns': 'Easy returns',
    'theme.product.trustReturnsNote': '14 days, no questions',
  },
} satisfies ThemeMessages;

/** Локальний union ключів — перевірка одруків у межах власного каталогу. */
export type ThemeKey = keyof typeof messages.uk;
