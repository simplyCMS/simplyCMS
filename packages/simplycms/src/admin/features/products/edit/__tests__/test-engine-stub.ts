import type { EngineContext } from 'simplycms/contracts';
import { ui } from '../../../../../../test-harness/locale';

/**
 * `ModificationsTable` → `useFormatPrice()` → `useEngine()` — мінімальний
 * контекст для рендер-тестів `ProductEditPage`, виніс, бо ДВА тести його
 * потребують (канон 150 рядків). 🔴 Не використовується всередині
 * `vi.mock(...)` — туди імпорт заборонений (хостинг Vitest), лише як
 * значення `<EngineProvider value={ENGINE}>`.
 */
export const ENGINE: EngineContext = {
  links: {
    product: (p) => `/${p.path}`,
    section: (s) => `/catalog/${s.slug}`,
    cart: () => '/cart',
    checkout: () => '/checkout',
    profile: (sub) => (sub ? `/profile/${sub}` : '/profile'),
    auth: () => '/auth',
  },
  config: {
    currency: 'UAH',
  },
};

export class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Формат цін тестових екранів: мова інтерфейсу `uk` (її дає `TestI18nProvider`) і валюта конфігу. */
export const PRICE_FORMAT = {
  locale: ui('uk'),
  currency: ENGINE.config.currency,
};
