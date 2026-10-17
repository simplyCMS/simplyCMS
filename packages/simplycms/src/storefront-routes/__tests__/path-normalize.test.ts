// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  defaultParseSearch,
} from '@tanstack/react-router';
import type { RouterContext } from 'simplycms/runtime';
import { createLocaleRewrite } from '../locale/rewrite';
import type { LocaleSet } from '../locale/resolve';
import { entitySearch } from '../pages/entity-route';
import {
  normalizeStorefrontRequest,
  type AddressLookup,
} from '../seo/normalize';

/**
 * І20: рівно ОДИН 301 на будь-яку неканонічну адресу сутності — мова, історія
 * адреси, історичний `?mod=`, слеш і форма query складаються в одну кінцеву
 * адресу. Реєстр тут — пам'ять із тією самою семантикою, що SQL
 * `resolveProductAddress` (БД-сторона доведена `storefront-path-normalize.test.ts`).
 */
const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en'],
};

/** Реєстр: (мова, шлях) → поточна адреса товару; токени `?mod=` по товару й мові. */
const PATHS: Record<string, string> = {
  'uk/old': 'new',
  'uk/new': 'new',
  'uk/x': 'x',
  'en/old-en': 'new-en',
  'en/new-en': 'new-en',
};
const TOKENS: Record<string, string> = {
  'uk/old': 'new',
  'uk/new': 'new',
  'uk/5': '7',
  'uk/7': '7',
};
const lookup: AddressLookup = async (locale, path, mod) => {
  const current = PATHS[`${locale}/${path}`];
  if (current === undefined) return null;
  return {
    path: current,
    mod: mod === null ? null : (TOKENS[`${locale}/${mod}`] ?? null),
  };
};

const run = (path: string) =>
  normalizeStorefrontRequest(new URL(path, 'http://localhost'), SET, lookup);
const location = async (path: string) =>
  (await run(path))?.headers.get('location');

/** Роутер, налаштований як у проді (rewrite мови + `validateSearch` сторінки сутності). */
function routerAt(url: string) {
  const root = createRootRouteWithContext<RouterContext>()({});
  const entity = createRoute({
    getParentRoute: () => root,
    path: '/$path',
    validateSearch: entitySearch,
  });
  return createRouter({
    routeTree: root.addChildren([entity]),
    history: createMemoryHistory({ initialEntries: [url] }),
    rewrite: createLocaleRewrite(SET, { current: SET.primary }),
    context: { locales: SET } as RouterContext,
    trailingSlash: 'never',
  });
}

/** Те саме порівняння, що `loadServerRoute`: інакше роутер додав би власний 307. */
function routerRedirects(url: string): boolean {
  const router = routerAt(url);
  const next = router.latestLocation;
  const canonical = router.buildLocation({
    to: next.pathname,
    search: true,
    params: true,
    hash: true,
    state: true,
    _includeValidateSearch: true,
  } as never);
  return next.publicHref !== canonical.publicHref;
}

describe('нормалізація адреси: ОДИН 301 (І20)', () => {
  it('/uk/old?utm=1 → ОДИН 301 на /new?utm=1 (мова + історія разом)', async () => {
    const res = await run('/uk/old?utm=1');
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe('/new?utm=1');
  });

  it('/old?utm=1 (без префікса) → /new?utm=1', async () => {
    expect(await location('/old?utm=1')).toBe('/new?utm=1');
  });

  it('/en/old-en/ → один 301 на /en/new-en (слеш + історія)', async () => {
    const res = await run('/en/old-en/');
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe('/en/new-en');
  });

  it('/x?mod=<старий токен> → ОДИН 301 на /x?mod=<новий>', async () => {
    const res = await run('/x?mod=old');
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe('/x?mod=new');
    expect(await location('/new?mod=old')).toBe('/new?mod=new');
  });

  it('історична адреса + історичний токен + utm → один 301 з усім разом', async () => {
    expect(await location('/uk/old/?mod=old&utm=1')).toBe('/new?mod=new&utm=1');
  });

  it('токен з цифр: історичний → поточний у лапкованій формі, яку роутер вважає канонічною', async () => {
    expect(await location('/new?mod=5')).toBe('/new?mod=%227%22');
    expect(routerRedirects('/new?mod=%227%22')).toBe(false);
    expect(await run('/new?mod=%227%22')).toBeNull();
  });

  describe('токен, який роутер розбирає як не-рядок (M4)', () => {
    const CASES = [
      ['true', '/new?mod=%22true%22'],
      ['false', '/new?mod=%22false%22'],
      ['null', '/new?mod=%22null%22'],
      ['123', '/new?mod=%22123%22'],
      // Роутер JSON-розбирає ці значення в ІНШЕ число (100000, втрата точності), але токен
      // береться рядком із сирого query — 301 веде на канонічну форму ТОГО САМОГО токена.
      ['1e5', '/new?mod=%221e5%22'],
      ['5e-3', '/new?mod=%225e-3%22'],
      ['12345678901234567', '/new?mod=%2212345678901234567%22'],
    ] as const;

    it.each(CASES)(
      '?mod=%s → один 301 у канонічну форму, після якої роутер мовчить',
      async (token, to) => {
        const res = await run(`/new?mod=${token}`);
        expect(res?.status).toBe(301);
        expect(res?.headers.get('location')).toBe(to);
        expect(await run(to)).toBeNull();
        expect(routerRedirects(to)).toBe(false);
      },
    );

    it('не токен: обʼєкт і масив відкидаються (301 без mod), а не зводяться до токена-рядка', async () => {
      for (const q of [
        'mod=%7B%22a%22%3A1%7D',
        'mod=a&mod=b',
        'mod=%5B1%2C2%5D',
      ]) {
        const res = await run(`/new?${q}`);
        expect(res?.status).toBe(301);
        expect(res?.headers.get('location')).toBe('/new');
        expect(routerRedirects('/new')).toBe(false);
      }
    });

    it('порожнє значення лишається як є; %-кодований токен читається як токен', async () => {
      expect(await run('/new?mod=')).toBeNull();
      expect(await location('/new?mod=%6Fld')).toBe('/new?mod=new');
    });

    it('канонічна форма читається назад тим самим токеном (вибір модифікації)', () => {
      for (const token of ['1e5', '12345678901234567', 'true', '5']) {
        const to = `/new?mod=${encodeURIComponent(JSON.stringify(token))}`;
        const parsed = defaultParseSearch(to.slice(to.indexOf('?')));
        expect(entitySearch(parsed)).toEqual({ mod: token });
      }
    });

    it('validateSearch сторінки зводить будь-який примітив до рядка, не примітив відкидає', () => {
      expect(entitySearch({ mod: 5 })).toEqual({ mod: '5' });
      expect(entitySearch({ mod: true })).toEqual({ mod: 'true' });
      expect(entitySearch({ mod: null })).toEqual({ mod: 'null' });
      expect(entitySearch({ mod: 'red' })).toEqual({ mod: 'red' });
      expect(entitySearch({ mod: [1] })).toEqual({ mod: undefined });
      expect(entitySearch({})).toEqual({ mod: undefined });
    });
  });

  it('невідомий токен лишається як є (без редіректу на ньому)', async () => {
    expect(await run('/new?mod=nope')).toBeNull();
  });

  it('видалена сутність (рядків в реєстрі немає) → null: роутер віддасть 404', async () => {
    expect(await run('/gone')).toBeNull();
    expect(await run('/en/gone')).toBeNull();
  });

  it('/x → null; поточна адреса не редіректиться', async () => {
    expect(await run('/x')).toBeNull();
    expect(await run('/new')).toBeNull();
    expect(await run('/en/new-en')).toBeNull();
  });

  it('службові сегменти й не-slug не ходять у реєстр', async () => {
    let calls = 0;
    const counting: AddressLookup = async () => {
      calls += 1;
      return null;
    };
    for (const p of ['/cart', '/catalog', '/a/b', '/Foo', '/']) {
      await normalizeStorefrontRequest(
        new URL(p, 'http://localhost'),
        SET,
        counting,
      );
    }
    expect(calls).toBe(0);
  });

  it('/en і /en/ — корінь мови: /en/ → один 301 на /en', async () => {
    expect(await location('/en/')).toBe('/en');
    expect(await run('/en')).toBeNull();
  });

  describe('форма query збігається з роутерною: після нашого 301 роутер мовчить', () => {
    const CASES = [
      ['закодований невідомий параметр', '/uk/x?utm=%31', '/x?utm=1'],
      [
        'повторений невідомий параметр',
        '/en/new-en?a=1&a=2',
        '/en/new-en?a=%5B1%2C2%5D',
      ],
      ['мова + закодований параметр', '/uk/old?utm=%31', '/new?utm=1'],
    ] as const;

    it.each(CASES)('%s: %s → один 301', async (_name, from, to) => {
      const res = await run(from);
      expect(res?.status).toBe(301);
      expect(res?.headers.get('location')).toBe(to);
      // Другого кроку немає: ні нашого...
      expect(await run(to)).toBeNull();
      // ...ні роутерного 307.
      expect(routerRedirects(to)).toBe(false);
    });

    it('контроль методики: сире %31 роутер ПЕРЕПИСАВ би (307) — тому 301 мусить нести канонічну форму', () => {
      expect(routerRedirects('/x?utm=%31')).toBe(true);
    });
  });
});
