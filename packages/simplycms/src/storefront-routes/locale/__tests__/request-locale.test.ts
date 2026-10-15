import { describe, expect, it } from 'vitest';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { resolveRequestLocale, type LocaleSet } from '../resolve';

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en', 'pt-BR'],
  known: ['uk', 'en', 'pt-BR', 'pl'],
};

describe('resolveRequestLocale: мова лише з першого сегмента (І30)', () => {
  it('/en/x → en, префікс зняти', () => {
    expect(resolveRequestLocale('/en/x', SET)).toEqual({
      locale: 'en',
      prefixed: true,
      rest: '/x',
    });
  });

  it('/x → основна, без префікса', () => {
    expect(resolveRequestLocale('/x', SET)).toEqual({
      locale: 'uk',
      prefixed: false,
      rest: '/x',
    });
  });

  it('/uk/x при основній uk → prefixed: true (привід для 301)', () => {
    expect(resolveRequestLocale('/uk/x', SET)).toEqual({
      locale: 'uk',
      prefixed: true,
      rest: '/x',
    });
  });

  it('корінь мови: /en → rest "/"', () => {
    expect(resolveRequestLocale('/en', SET).rest).toBe('/');
    expect(resolveRequestLocale('/en/', SET).rest).toBe('/');
  });

  it('/EN/x → не мова (регістр сегмента лише малий)', () => {
    expect(resolveRequestLocale('/EN/x', SET)).toEqual({
      locale: 'uk',
      prefixed: false,
      rest: '/EN/x',
    });
  });

  it('/catalog → основна', () => {
    expect(resolveRequestLocale('/catalog', SET).locale).toBe('uk');
    expect(resolveRequestLocale('/catalog', SET).prefixed).toBe(false);
  });

  it('код з регіоном: сегмент pt-br → мова pt-BR (код як у БД)', () => {
    expect(resolveRequestLocale('/pt-br/x', SET)).toEqual({
      locale: 'pt-BR',
      prefixed: true,
      rest: '/x',
    });
  });

  it('відома, але неопублікована мова: префікс є, рішення про 404 — за нормалізацією', () => {
    expect(resolveRequestLocale('/pl/x', SET)).toEqual({
      locale: 'pl',
      prefixed: true,
      rest: '/x',
    });
  });

  it('сегмент не є префіксом, якщо це частина довшого імені (/english)', () => {
    expect(resolveRequestLocale('/english/x', SET).prefixed).toBe(false);
  });

  it.each([
    '/admin/en',
    '/api/en/x',
    '/_serverFn/en',
    '/assets/en/a.js',
    '/media/en',
  ])('службовий шлях %s мови не має', (path) => {
    const r = resolveRequestLocale(path, SET);
    expect(r).toEqual({ locale: 'uk', prefixed: false, rest: path });
  });

  it('Accept-Language не впливає: функція не приймає заголовків за типом', () => {
    // Третього параметра немає. Якщо його додати (читати заголовок), директива
    // стане зайвою і `pnpm typecheck` стане червоним.
    // @ts-expect-error — resolveRequestLocale(pathname, set): лише два аргументи
    expect(resolveRequestLocale('/x', SET, new Headers()).locale).toBe('uk');
  });
});

describe('ключ кешу з мови запиту: SSR і гідрація (І36, умова 2)', () => {
  it('на /en/x ключі збігаються, бо мову дає одна функція', () => {
    // Сервер: повний набір мов. Клієнт після гідрації: набір з
    // `window.__SCMS_LOCALES__`, де `known` = `published`. Та сама адреса.
    const client: LocaleSet = {
      primary: SET.primary,
      published: SET.published,
      known: SET.published,
    };
    const ssr = resolveRequestLocale('/en/x', SET).locale;
    const hydrated = resolveRequestLocale('/en/x', client).locale;
    expect(ssr).toBe('en');
    expect(entityKey(ENTITY.products, ssr).detail('p1')).toEqual(
      entityKey(ENTITY.products, hydrated).detail('p1'),
    );
  });
});
