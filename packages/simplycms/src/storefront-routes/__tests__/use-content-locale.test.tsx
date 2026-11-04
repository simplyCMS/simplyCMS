// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createLocaleRewrite } from '../locale/rewrite';
import type { RouterContext } from 'simplycms/runtime';
import { useContentLocale } from 'simplycms/runtime/content-locale';
import { cl, localeSet } from '../../../test-harness/locale';

afterEach(cleanup);

const SET = localeSet('uk', ['uk', 'en']);

function Probe() {
  return <span data-testid="locale">{useContentLocale()}</span>;
}

/**
 * Справжній роутер із `rewrite`, як у продакшні: хук мусить читати `location.publicHref`
 * (з префіксом мови), а не `pathname`, який після `rewrite` уже без префікса, і набір мов —
 * з контексту матчу.
 */
async function localeAt(url: string): Promise<string> {
  const root = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <>
        <Probe />
        <Outlet />
      </>
    ),
  });
  const splat = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([splat]),
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { locales: SET } as RouterContext,
    rewrite: createLocaleRewrite(SET, { current: cl('uk') }),
  });
  render(<RouterProvider router={router} />);
  return (await screen.findByTestId('locale')).textContent ?? '';
}

describe('useContentLocale під справжнім роутером (І30)', () => {
  it('/en/x → en: мова з префікса publicHref', async () => {
    expect(await localeAt('/en/x')).toBe('en');
  });

  it('/x → основна мова', async () => {
    expect(await localeAt('/x')).toBe('uk');
  });
});
