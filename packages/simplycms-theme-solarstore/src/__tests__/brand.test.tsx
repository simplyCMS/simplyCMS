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

// Роутер, кошик, авторизація й запит розділів тут не потрібні: перевіряється
// лише те, що Header/Footer беруть із профілю.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => () => {},
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAdmin: false,
    signOut: () => Promise.resolve(),
  }),
}));
vi.mock('simplycms/core/hooks/useCart', () => ({
  useCart: () => ({ totalItems: 0, setIsOpen: () => {} }),
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: () => {} }),
}));
vi.mock('simplycms/core/components/cart/CartDrawer', () => ({
  CartDrawer: () => null,
}));
vi.mock('simplycms/storefront-routes/server/home', () => ({
  getRootSections: () => Promise.resolve([]),
}));

const { Header, Footer } = theme.components;

function renderWith(ui: ReactNode, profile: StorefrontProfile) {
  return render(
    <I18nProvider locale="uk">
      <ThemeProvider initialThemeName="solarstore">
        <StoreProfileProvider profile={profile}>
          <Suspense fallback={null}>{ui}</Suspense>
        </StoreProfileProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
}

beforeEach(async () => {
  ThemeRegistry.register('solarstore', () =>
    Promise.resolve({ default: theme }),
  );
  await ThemeRegistry.load('solarstore');
});
afterEach(() => {
  cleanup();
  ThemeRegistry.unregister('solarstore');
  ThemeRegistry.clearCache();
});

describe('Header solarstore: бренд із профілю', () => {
  it('є logoUrl → <img alt={name}>, текстового бренду немає', async () => {
    renderWith(<Header />, STORE_PROFILE_FIXTURE);
    const img = await screen.findByAltText(STORE_PROFILE_FIXTURE.name);
    expect(img.getAttribute('src')).toBe('/media/logo.png');
    expect(screen.queryByText(STORE_PROFILE_FIXTURE.name)).toBeNull();
    expect(screen.queryByText('SolarStore')).toBeNull();
  });

  it('logoUrl = null → текст name, без літералу SolarStore', async () => {
    renderWith(<Header />, { ...STORE_PROFILE_FIXTURE, logoUrl: null });
    expect(await screen.findByText(STORE_PROFILE_FIXTURE.name)).toBeTruthy();
    expect(screen.queryByText('SolarStore')).toBeNull();
  });

  it('жодного мертвого href="#"', async () => {
    const { container } = renderWith(<Header />, STORE_PROFILE_FIXTURE);
    await screen.findByAltText(STORE_PROFILE_FIXTURE.name);
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });
});

describe('Footer solarstore: контакти й соцмережі з профілю', () => {
  it('телефон → tel:, email → mailto:, заглушок немає', async () => {
    const { container } = renderWith(<Footer />, STORE_PROFILE_FIXTURE);
    await screen.findByText(STORE_PROFILE_FIXTURE.contacts.address!);
    expect(
      container.querySelector('a[href="tel:+380441234567"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="mailto:shop@example.com"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain('+380 (XX)');
    expect(container.textContent).not.toContain('info@solarstore.ua');
    expect(container.textContent).not.toContain('SolarStore');
  });

  it('телефон без цифр → текст як є, без порожнього tel:', async () => {
    const contacts = { ...STORE_PROFILE_FIXTURE.contacts, phone: 'за запитом' };
    const view = renderWith(<Footer />, { ...STORE_PROFILE_FIXTURE, contacts });
    expect((await screen.findByText('за запитом')).closest('a')).toBeNull();
    expect(view.container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('порожня адреса не рендериться (і «Україна» теж)', async () => {
    const { container } = renderWith(<Footer />, {
      ...STORE_PROFILE_FIXTURE,
      contacts: { ...STORE_PROFILE_FIXTURE.contacts, address: null },
    });
    await screen.findByText(STORE_PROFILE_FIXTURE.contacts.email!);
    expect(screen.queryByText(/Тестова, 1/)).toBeNull();
    expect(container.textContent).not.toContain('Україна');
  });

  it('соцмережа: href із профілю й aria-label, жодного href="#"', async () => {
    const { container } = renderWith(<Footer />, STORE_PROFILE_FIXTURE);
    const link = await screen.findByLabelText('Instagram');
    expect(link.getAttribute('href')).toBe('https://instagram.com/test-shop');
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });

  it('копірайт із name, без контактів блок контактів не рендериться', async () => {
    const { container } = renderWith(<Footer />, {
      ...STORE_PROFILE_FIXTURE,
      contacts: { phone: null, email: null, address: null, hours: null },
      socials: [],
    });
    const year = new Date().getFullYear();
    expect(
      await screen.findByText(
        new RegExp(`© ${year} ${STORE_PROFILE_FIXTURE.name}`),
      ),
    ).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('svg.lucide-phone')).toBeNull();
  });
});
