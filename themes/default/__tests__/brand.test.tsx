// @vitest-environment jsdom
import { Suspense, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { ThemeProvider } from 'simplycms/themes/ThemeContext';
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import { StoreProfileProvider } from 'simplycms/themes/store-profile';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import { STORE_PROFILE_FIXTURE } from 'simplycms/contracts/views/fixtures';
import theme from '../index';

// Роутер і важкі споживачі стану вітрини (кошик, авторизація) тут не
// потрібні: перевіряється лише те, що Header/Footer беруть із профілю.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useRouterState: () => '/',
}));
vi.mock('../components/HeaderActions', () => ({ HeaderActions: () => null }));
vi.mock('simplycms/core/components/cart/CartDrawer', () => ({
  CartDrawer: () => null,
}));

const { Header, Footer } = theme.components;

function renderWith(ui: ReactNode, profile: StorefrontProfile) {
  return render(
    <I18nProvider locale="uk">
      <ThemeProvider initialThemeName="default">
        <StoreProfileProvider profile={profile}>
          <Suspense fallback={null}>{ui}</Suspense>
        </StoreProfileProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
}

beforeEach(async () => {
  ThemeRegistry.register('default', () => Promise.resolve({ default: theme }));
  // Попередньо виконаний проміс реєстру: `use()` в `useThemeT` розгортає його
  // синхронно, і тест не залежить від ретраю Suspense поза `act`.
  await ThemeRegistry.load('default');
});
afterEach(() => {
  cleanup();
  ThemeRegistry.unregister('default');
  ThemeRegistry.clearCache();
});

describe('Header default-теми: бренд із профілю', () => {
  it('є logoUrl → <img alt={name}>, текстового бренду немає', async () => {
    renderWith(<Header />, STORE_PROFILE_FIXTURE);
    const img = await screen.findByAltText(STORE_PROFILE_FIXTURE.name);
    expect(img.getAttribute('src')).toBe('/media/logo.png');
    expect(screen.queryByText(STORE_PROFILE_FIXTURE.name)).toBeNull();
  });

  it('logoUrl = null → текст name', async () => {
    renderWith(<Header />, { ...STORE_PROFILE_FIXTURE, logoUrl: null });
    expect(await screen.findByText(STORE_PROFILE_FIXTURE.name)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Footer default-теми: контакти й соцмережі з профілю', () => {
  it('телефон → tel: лише з + і цифр, email → mailto:', async () => {
    const { container } = renderWith(<Footer />, STORE_PROFILE_FIXTURE);
    await screen.findByText(STORE_PROFILE_FIXTURE.contacts.address!);
    expect(
      container.querySelector('a[href="tel:+380441234567"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="mailto:shop@example.com"]'),
    ).not.toBeNull();
    expect(
      screen.getByText(STORE_PROFILE_FIXTURE.contacts.hours!),
    ).toBeTruthy();
  });

  it('телефон без цифр → текст як є, без порожнього tel:', async () => {
    const { container } = renderWith(<Footer />, {
      ...STORE_PROFILE_FIXTURE,
      contacts: { ...STORE_PROFILE_FIXTURE.contacts, phone: 'за запитом' },
    });
    const phone = await screen.findByText('за запитом');
    expect(phone.closest('a')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('порожня адреса не рендериться', async () => {
    renderWith(<Footer />, {
      ...STORE_PROFILE_FIXTURE,
      contacts: { ...STORE_PROFILE_FIXTURE.contacts, address: null },
    });
    await screen.findByText(STORE_PROFILE_FIXTURE.contacts.hours!);
    expect(screen.queryByText(/Тестова, 1/)).toBeNull();
  });

  it('соцмережа: href із профілю й aria-label, жодного href="#"', async () => {
    const { container } = renderWith(<Footer />, STORE_PROFILE_FIXTURE);
    const link = await screen.findByLabelText('Instagram');
    expect(link.getAttribute('href')).toBe('https://instagram.com/test-shop');
    expect(screen.getByLabelText('Telegram')).toBeTruthy();
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });

  it('без контактів і соцмереж — жодних зайвих посилань, копірайт з name', async () => {
    const { container } = renderWith(<Footer />, {
      ...STORE_PROFILE_FIXTURE,
      contacts: { phone: null, email: null, address: null, hours: null },
      socials: [],
    });
    const year = new Date().getFullYear();
    expect(
      await screen.findByText(`© ${year} ${STORE_PROFILE_FIXTURE.name}`),
    ).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });
});
