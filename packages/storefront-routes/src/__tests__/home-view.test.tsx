// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@simplycms/i18n';
import { HOME_REQUISITES, type HomeSlots } from '@simplycms/objects/views';
import { homeViewModelFixtures } from '@simplycms/objects/views/fixtures';

/**
 * Conformance-прогін канонічного `HomeView` на фікстурах (контракт тем v3,
 * Фаза 5, Step 3) — до появи kit-а Фази 6.
 *
 * 🔴 Це водночас ДОКАЗ чистоти view: провайдери тут i18n і замоканий
 * `useActiveThemeModule` (контракт v2.2, старший за `theme.views` — сам
 * view читає його для Hero/HomeSections, спека §9). Ні supabase-клієнта, ні
 * QueryClient немає, тож будь-який фетч усередині view впав би тут.
 * `ProductCarousel`/`BannerSlider` замокано — вони самі використовують
 * `embla-carousel-react` (реальний рендер під jsdom без полiфілу
 * ResizeObserver зайвий для цього тесту; той самий прийом — у
 * `home-n-plus-one.test.tsx`), тут під тестом лише логіка `HomeView`.
 *
 * 🔴 На відміну від ProductDetail/Catalog, `REQUIRED_REQUISITES.Home`
 * навмисно порожній (спека §5): `SectionCarousel` рендериться 0..N разів —
 * по кореневій секції. Тому тут перевіряється сильніше й конкретніше
 * твердження — кількість маркерів дорівнює кількості секцій у фікстурі.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));

vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../components/BannerSlider', () => ({
  BannerSlider: ({ banners }: { banners?: unknown[] }) => (
    <div data-testid="banner-slider">{banners?.length ?? 0}</div>
  ),
}));

import { HomeView } from '../views/HomeView';

/** Стаб реквізиту: тільки маркер — рівно те, що шукатиме kit Фази 6. */
function requisiteStub(name: string) {
  return function RequisiteStub({ sectionId }: { sectionId: string }) {
    return <div data-simplycms-requisite={name} data-section-id={sectionId} />;
  };
}

const stubSlots: HomeSlots = {
  SectionCarousel: requisiteStub(HOME_REQUISITES.SectionCarousel),
};

function renderHome(state: 'full' | 'edge') {
  return render(
    <I18nProvider locale="uk">
      <HomeView {...homeViewModelFixtures[state]} slots={stubSlots} />
    </I18nProvider>,
  );
}

function requisitesOf(container: HTMLElement): (string | null)[] {
  return Array.from(
    container.querySelectorAll('[data-simplycms-requisite]'),
  ).map((node) => node.getAttribute('data-simplycms-requisite'));
}

describe('HomeView — канонічний view на фікстурах', () => {
  afterEach(cleanup);

  it('повний стан: тема без HeroBanner — рендериться BannerSlider з банерами', () => {
    const { getByTestId } = renderHome('full');

    expect(getByTestId('banner-slider').textContent).toBe('1');
  });

  it('повний стан: добірки — популярні й новинки — в розмітці', () => {
    const { container } = renderHome('full');

    expect(container.textContent).toContain('Лідери продажів');
    expect(container.textContent).toContain('Новинки');
  });

  it('повний стан: по одному реквізиту на кожну кореневу секцію', () => {
    const { container } = renderHome('full');
    const vm = homeViewModelFixtures.full;

    expect(requisitesOf(container)).toEqual(
      vm.sections.items.map(() => HOME_REQUISITES.SectionCarousel),
    );
  });

  it('крайній стан: магазин без банерів, добірок і секцій — без падіння', () => {
    const { container, getByTestId } = renderHome('edge');

    expect(getByTestId('banner-slider').textContent).toBe('0');
    expect(requisitesOf(container)).toEqual([]);
  });
});
