/**
 * Каталог перекладів теми SolarStore (`ThemeModule.messages`, контракт v2).
 *
 * Сюди йде ЛИШЕ текст, унікальний для цієї теми (маркетинг, копірайт,
 * розділи підвалу, hero): рядки, що збігаються з core-ключами
 * (`catalog.title`, `nav.signOut`, `auth.login.submit`, `common.error`, …),
 * компоненти беруть через `useT()` напряму — дублювати їх тут не треба.
 */
export const messages = {
  uk: {
    'theme.footer.description':
      'Професійні рішення з альтернативної енергетики для вашого дому та бізнесу.',
    'theme.nav.brands': 'Бренди',
    'theme.footer.shippingPayment': 'Доставка і оплата',
    'theme.footer.warranty': 'Гарантія',
    'theme.footer.returns': 'Повернення',
    'theme.nav.contacts': 'Контакти',
    'theme.footer.country': 'Україна',
    'theme.footer.copyright': '© {year} SolarStore. Всі права захищено.',

    'theme.header.categoryBatteries': 'Акумулятори',
    'theme.header.categoryInverters': 'Інвертори',
    'theme.header.categorySolarPanels': 'Сонячні панелі',
    'theme.header.categoryInstallation': 'Послуги монтажу',
    'theme.header.signOutError': 'Не вдалося вийти з акаунту',
    'theme.header.signedOut': 'Вихід виконано',
    'theme.header.seeYouSoon': 'До зустрічі!',
    'theme.header.myAccount': 'Мій кабінет',
    'theme.header.adminPanel': 'Адмін-панель',
    'theme.nav.about': 'Про нас',

    'theme.hero.titlePrefix': 'Енергетична',
    'theme.hero.titleHighlight': 'незалежність',
    'theme.hero.titleSuffix': 'для вашого дому',
    'theme.hero.subtitle':
      'Професійні рішення з альтернативної енергетики: акумулятори, інвертори, сонячні панелі та послуги монтажу під ключ',
    'theme.hero.ctaCatalog': 'Переглянути каталог',
    'theme.hero.ctaConsultation': 'Замовити консультацію',

    'theme.home.advantagesHeading': 'Чому обирають нас',
    'theme.home.advantage1': 'років досвіду',
    'theme.home.advantage2': 'встановлених систем',
    'theme.home.advantage3': 'підтримка клієнтів',
    'theme.home.advantage4': 'роки гарантії',
    'theme.home.ctaHeading': 'Потрібна консультація?',
    'theme.home.ctaText':
      "Наші експерти допоможуть підібрати оптимальне рішення для вашого об'єкту",
    'theme.home.ctaButton': 'Замовити дзвінок',
  },
  en: {
    'theme.footer.description':
      'Professional alternative energy solutions for your home and business.',
    'theme.nav.brands': 'Brands',
    'theme.footer.shippingPayment': 'Shipping & payment',
    'theme.footer.warranty': 'Warranty',
    'theme.footer.returns': 'Returns',
    'theme.nav.contacts': 'Contact',
    'theme.footer.country': 'Ukraine',
    'theme.footer.copyright': '© {year} SolarStore. All rights reserved.',

    'theme.header.categoryBatteries': 'Batteries',
    'theme.header.categoryInverters': 'Inverters',
    'theme.header.categorySolarPanels': 'Solar panels',
    'theme.header.categoryInstallation': 'Installation services',
    'theme.header.signOutError': "Couldn't sign you out",
    'theme.header.signedOut': 'Signed out',
    'theme.header.seeYouSoon': 'See you soon!',
    'theme.header.myAccount': 'My account',
    'theme.header.adminPanel': 'Admin panel',
    'theme.nav.about': 'About us',

    'theme.hero.titlePrefix': 'Energy',
    'theme.hero.titleHighlight': 'independence',
    'theme.hero.titleSuffix': 'for your home',
    'theme.hero.subtitle':
      'Professional alternative energy solutions: batteries, inverters, solar panels, and turnkey installation services',
    'theme.hero.ctaCatalog': 'Browse catalog',
    'theme.hero.ctaConsultation': 'Request a consultation',

    'theme.home.advantagesHeading': 'Why choose us',
    'theme.home.advantage1': 'years of experience',
    'theme.home.advantage2': 'systems installed',
    'theme.home.advantage3': 'customer support',
    'theme.home.advantage4': 'year warranty',
    'theme.home.ctaHeading': 'Need a consultation?',
    'theme.home.ctaText':
      'Our experts will help you choose the best solution for your property',
    'theme.home.ctaButton': 'Request a call',
  },
} as const;

/**
 * Union власних ключів теми — дає `useThemeT<SolarstoreThemeKey>()`
 * перевірку одруків у межах ЦЬОГО каталогу (аналог `MessageKey` ядра, але
 * не з ним).
 */
export type SolarstoreThemeKey = keyof typeof messages.uk;
