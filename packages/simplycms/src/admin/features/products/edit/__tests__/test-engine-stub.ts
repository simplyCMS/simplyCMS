import type { EngineContext } from 'simplycms/contracts';

/**
 * `ModificationsTable` → `useFormatPrice()` → `useEngine()` — мінімальний
 * контекст для рендер-тестів `ProductEditPage`, виніс, бо ДВА тести його
 * потребують (канон 150 рядків). 🔴 Не використовується всередині
 * `vi.mock(...)` — туди імпорт заборонений (хостинг Vitest), лише як
 * значення `<EngineProvider value={ENGINE}>`.
 */
export const ENGINE: EngineContext = {
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
    seo: { defaultTitle: 'Test', titleTemplate: '%s', defaultDescription: '' },
  },
};

export class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
