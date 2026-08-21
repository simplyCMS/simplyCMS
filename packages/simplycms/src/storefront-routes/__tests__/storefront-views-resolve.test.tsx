// @vitest-environment jsdom
import type { ComponentType } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ThemeModule, ThemeViews } from 'simplycms/themes/types';

/**
 * Резолв view сторінки вітрини (контракт тем v3, Фаза 3, Step 3).
 *
 * Негативний контроль механізму: тема БЕЗ `views` нічого не змінює, тема з
 * `views.<Name>` підміняє канонічний view цілком, а заявка на ІНШУ сторінку
 * поточної не чіпає. Джерело теми (`useActiveThemeModule`) замокано — під
 * тестом саме правило вибору.
 */
const themeModule: { current: ThemeModule } = {
  current: {} as ThemeModule,
};

vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => themeModule.current,
}));

import { useStorefrontViews } from '../views/useStorefrontViews';

function CanonicalView() {
  return <div data-testid="canonical" />;
}

function ThemeView() {
  return <div data-testid="theme" />;
}

const canonical = {
  ProductDetail: CanonicalView as NonNullable<ThemeViews['ProductDetail']>,
};

function Probe() {
  // Пропси тут неважливі — під тестом ВИБІР компонента, не його рендер.
  const views = useStorefrontViews(canonical) as {
    ProductDetail: ComponentType;
  };
  return <views.ProductDetail />;
}

function withViews(views: ThemeViews | undefined) {
  themeModule.current = { views } as unknown as ThemeModule;
}

describe('useStorefrontViews', () => {
  afterEach(cleanup);

  it('тема без views — рендериться канонічний view ядра', () => {
    withViews(undefined);
    const { queryByTestId } = render(<Probe />);

    expect(queryByTestId('canonical')).not.toBeNull();
    expect(queryByTestId('theme')).toBeNull();
  });

  it('тема з порожнім views — теж канонічний', () => {
    withViews({});
    const { queryByTestId } = render(<Probe />);

    expect(queryByTestId('canonical')).not.toBeNull();
  });

  it('тема заявила ProductDetail — рендериться view теми', () => {
    withViews({
      ProductDetail: ThemeView as NonNullable<ThemeViews['ProductDetail']>,
    });
    const { queryByTestId } = render(<Probe />);

    expect(queryByTestId('theme')).not.toBeNull();
    expect(queryByTestId('canonical')).toBeNull();
  });

  it('тема заявила ІНШУ сторінку — ProductDetail лишається канонічним', () => {
    withViews({ Cart: ThemeView as NonNullable<ThemeViews['Cart']> });
    const { queryByTestId } = render(<Probe />);

    expect(queryByTestId('canonical')).not.toBeNull();
    expect(queryByTestId('theme')).toBeNull();
  });
});
