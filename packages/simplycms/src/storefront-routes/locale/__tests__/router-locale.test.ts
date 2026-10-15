import { describe, expect, it, vi } from 'vitest';
import {
  getRequestContext,
  withRequestContext,
} from 'simplycms/site/request-context';
import { createRouterLocale } from '../router';
import { loadStorefrontRoot } from '../root-data';
import { NO_LOCALES, type LocaleSet } from '../resolve';

vi.mock('../../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: { name: 'Shop' },
    siteUrl: '',
  }),
}));

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en'],
};

/** Виконати `fn` у контексті запиту; `locales` — те, що виставила нормалізація. */
async function inRequest<T>(locales: LocaleSet | undefined, fn: () => T) {
  let result!: T;
  await withRequestContext(async () => {
    if (locales) getRequestContext()!.storefront = { locales };
    result = fn();
    return new Response('ok');
  })(new Request('http://localhost/'));
  return result;
}

describe('createRouterLocale (сервер)', () => {
  it('набір мов із контексту запиту → context.locales і rewrite', async () => {
    const r = await inRequest(SET, createRouterLocale);
    expect(r.locales).toBe(SET);
    expect(r.rewrite).toBeDefined();
  });

  it('запит без мов (server function, API, медіа) → порожній набір без rewrite', async () => {
    const r = await inRequest(undefined, createRouterLocale);
    expect(r.locales).toBe(NO_LOCALES);
    expect(r.rewrite).toBeUndefined();
  });

  it('поза запитом (CLI, тест) → те саме, без падіння', () => {
    expect(createRouterLocale().locales).toBe(NO_LOCALES);
  });
});

describe('loadStorefrontRoot без мовного контексту', () => {
  it('документ без набору мов відмовляє гучно, а не віддає мову ""', async () => {
    await expect(loadStorefrontRoot('/x', NO_LOCALES)).rejects.toThrow(
      /resolveRouterLocales/,
    );
  });
});
