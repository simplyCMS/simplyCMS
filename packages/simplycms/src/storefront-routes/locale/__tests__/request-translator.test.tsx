// @vitest-environment jsdom
import { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_LOCALES } from 'simplycms/domain';
import { PLATFORM_FALLBACK_UI, loadUiCatalog } from 'simplycms/i18n';

const router = vi.hoisted(() => ({ locales: undefined as unknown }));
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { publicHref: '/x' } }),
  useRouteContext: () => ({ locales: router.locales }),
  Link: ({ children }: { children: unknown }) => (
    <a href="/">{children as never}</a>
  ),
}));

import { RootNotFound } from '../RootNotFound';

/** Екран, що рендериться ПОЗА провайдером: кидок тут валить сам екран помилки. */
describe('useRequestTranslator без мовного контексту (§19.15)', () => {
  afterEach(cleanup);

  it('NO_LOCALES (beforeLoad кореня впав) → екран рендериться мовою en', async () => {
    router.locales = NO_LOCALES;
    // `use` розгортає лише вже завантажену частину синхронно (як після `beforeLoad` у проді).
    await loadUiCatalog(PLATFORM_FALLBACK_UI, 'base');

    render(
      <Suspense fallback={null}>
        <RootNotFound />
      </Suspense>,
    );

    expect(await screen.findByText('Page not found')).toBeTruthy();
    expect(screen.getByText('Back to home')).toBeTruthy();
  });
});
