import type { ReactNode } from 'react';
import type { EngineContext } from 'simplycms/contracts';
import { EngineProvider } from 'simplycms/react-query';

/**
 * EngineContext для рендер-тестів сторінок.
 *
 * 🔴 Навіщо він зʼявився. Форматування ціни перестало бути локальною копією
 * `Intl.NumberFormat` у кожному компоненті й пішло через `useFormatPrice()`,
 * який бере локаль і валюту з `useEngine().config`. Це навмисно: 14 копій
 * ігнорували `simplycms.config.ts` і брали символ валюти з CLDR рушія, через
 * що SSR давав «₴», а браузер «грн» (гідраційний мисматч). Ціна рішення —
 * будь-який тест, що рендерить сторінку з ціною, тепер зобовʼязаний дати
 * EngineContext, як це робить прод (`ClientEngineProvider` у `__root.tsx`).
 *
 * 🔴 V2: стаб більше не звужений кастом — контейнер сам звузився до двох
 * чистих провайдерів (репозиторії знесені разом із шаром `data-supabase`),
 * тож тут заповнено рівно те, що є в контракті.
 */
const engine: EngineContext = {
  links: {
    product: (p) => `/catalog/${p.slug}`,
    section: (s) => `/catalog/${s.slug}`,
    cart: () => '/cart',
    checkout: () => '/checkout',
    profile: (sub) => (sub ? `/profile/${sub}` : '/profile'),
    auth: () => '/auth',
  },
  config: {
    locale: 'uk-UA',
    currency: 'UAH',
    siteUrl: 'https://example.test',
    seo: {
      defaultTitle: 'Test store',
      titleTemplate: '%s',
      defaultDescription: '',
    },
  },
};

export function TestEngineProvider({ children }: { children: ReactNode }) {
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}
