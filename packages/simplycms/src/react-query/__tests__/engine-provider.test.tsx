// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { EngineContext } from 'simplycms/contracts';
import { EngineProvider, useEngine } from '../EngineProvider';

// 🔴 V2: EngineContext звужений до двох чистих провайдерів — репозиторії й
// порт-хуки знесені разом із шаром `data-supabase` (браузер у БД не ходить).
// Тож фікстура тут повна, а не «мінімальна»: у контейнері справді два поля.
const mockEngine: EngineContext = {
  links: {
    product: (p) => `/catalog/${p.slug}`,
    section: (s) => `/catalog/${s.slug}`,
    cart: () => '/cart',
    checkout: () => '/checkout',
    profile: () => '/profile',
    auth: () => '/auth',
  },
  config: {
    locale: 'uk-UA',
    currency: 'UAH',
    siteUrl: '',
    seo: { defaultTitle: '', titleTemplate: '%s', defaultDescription: '' },
  },
};

function wrapper({ children }: { children: ReactNode }) {
  return <EngineProvider value={mockEngine}>{children}</EngineProvider>;
}

describe('EngineProvider / useEngine wiring', () => {
  it('useEngine returns the injected context', () => {
    const { result } = renderHook(() => useEngine(), { wrapper });
    expect(result.current.config.currency).toBe('UAH');
    expect(result.current.links.cart()).toBe('/cart');
  });

  it('useEngine throws outside a provider', () => {
    expect(() => renderHook(() => useEngine())).toThrow(/EngineProvider/);
  });
});
