/**
 * Каталог перекладів теми Default (`ThemeModule.messages`, контракт v2).
 *
 * Сюди йде ЛИШЕ текст, унікальний для цієї теми (маркетинг, копірайт,
 * розділи підвалу): рядки, що збігаються з core-ключами (`catalog.title`,
 * `cart.title`, `nav.orders`, `common.information`, …), компоненти беруть
 * через `useT()` напряму — дублювати їх тут не треба.
 */
export const messages = {
  uk: {
    'theme.nav.brands': 'Бренди',
    'theme.footer.shippingPayment': 'Доставка і оплата',
    'theme.footer.returns': 'Повернення',
    'theme.footer.contacts': 'Контакти',
    'theme.footer.accountHeading': 'Мій акаунт',
    'theme.footer.accountLink': 'Кабінет',
    'theme.footer.copyright': '© {year} {storeName}. Усі права захищено.',

    'theme.header.signedOut': 'Вихід виконано',
    'theme.header.myAccount': 'Мій кабінет',
    'theme.header.adminPanel': 'Адмін-панель',

    'theme.announcementBar.default':
      'При сумі замовлення понад 1500 грн — доставка безкоштовна!',

    'theme.blog.heading': 'Останні статті',
    'theme.blog.article1Title': 'Як обрати ідеальний засіб для догляду',
    'theme.blog.article1Excerpt':
      'Поради від експертів щодо підбору косметики для вашого типу шкіри.',
    'theme.blog.article1Date': '15 лютого 2026',
    'theme.blog.article2Title': 'Тренди краси 2026 року',
    'theme.blog.article2Excerpt':
      "Огляд найактуальніших тенденцій у світі б'юті-індустрії.",
    'theme.blog.article2Date': '10 лютого 2026',
    'theme.blog.article3Title': 'Догляд за шкірою взимку',
    'theme.blog.article3Excerpt':
      'Правила зволоження та захисту шкіри в холодну пору року.',
    'theme.blog.article3Date': '5 лютого 2026',

    'theme.newsletter.heading': 'Підпишіться на розсилку',
    'theme.newsletter.subtitle':
      'Отримуйте новини та спеціальні пропозиції першими',
    'theme.newsletter.placeholder': 'Ваш email',
    'theme.newsletter.submit': 'Підписатись',
    'theme.newsletter.thanksTitle': 'Дякуємо!',
    'theme.newsletter.thanksDescription': 'Ви підписані на розсилку.',
  },
  en: {
    'theme.nav.brands': 'Brands',
    'theme.footer.shippingPayment': 'Shipping & payment',
    'theme.footer.returns': 'Returns',
    'theme.footer.contacts': 'Contact',
    'theme.footer.accountHeading': 'My Account',
    'theme.footer.accountLink': 'Account',
    'theme.footer.copyright': '© {year} {storeName}. All rights reserved.',

    'theme.header.signedOut': 'Signed out',
    'theme.header.myAccount': 'My account',
    'theme.header.adminPanel': 'Admin panel',

    'theme.announcementBar.default': 'Free shipping on orders over 1,500 UAH!',

    'theme.blog.heading': 'Latest articles',
    'theme.blog.article1Title': 'How to choose the right skincare product',
    'theme.blog.article1Excerpt':
      'Expert tips on choosing cosmetics for your skin type.',
    'theme.blog.article1Date': 'February 15, 2026',
    'theme.blog.article2Title': '2026 beauty trends',
    'theme.blog.article2Excerpt':
      'A look at the hottest trends in the beauty industry.',
    'theme.blog.article2Date': 'February 10, 2026',
    'theme.blog.article3Title': 'Winter skincare',
    'theme.blog.article3Excerpt':
      'Rules for hydrating and protecting your skin in cold weather.',
    'theme.blog.article3Date': 'February 5, 2026',

    'theme.newsletter.heading': 'Subscribe to our newsletter',
    'theme.newsletter.subtitle': 'Be the first to get news and special offers',
    'theme.newsletter.placeholder': 'Your email',
    'theme.newsletter.submit': 'Subscribe',
    'theme.newsletter.thanksTitle': 'Thank you!',
    'theme.newsletter.thanksDescription':
      "You're subscribed to our newsletter.",
  },
} as const;

/**
 * Union власних ключів теми — дає `useThemeT<DefaultThemeKey>()` перевірку
 * одруків у межах ЦЬОГО каталогу (аналог `MessageKey` ядра, але не з ним).
 */
export type DefaultThemeKey = keyof typeof messages.uk;
