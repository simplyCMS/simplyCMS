import { describe, expect, it } from 'vitest';
// `defaultSerovalPlugins` з router-core 1.171 живе лише в субшляху
// `./ssr/client` (з кореня пакета прибрано) — звідти ж його бере й сам Start.
import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from '@tanstack/router-core/ssr/client';
import { fromCrossJSON, toCrossJSONAsync } from 'seroval';
import { domainErrorAdapter } from '../domain-error-adapter';

// Тип масиву плагінів — рівно той, що приймає seroval (без `any`).
type SerovalPlugins = NonNullable<
  NonNullable<Parameters<typeof toCrossJSONAsync>[1]>['plugins']
>;

/**
 * Е3-20: перетинає РЕАЛЬНУ межу serverFn — той самий механізм, яким Start
 * (де)серіалізує відповідь server function (`server-functions-handler.ts`:
 * `toCrossJSONStream`/`toCrossJSONAsync` на сервері; `serverFnFetcher.ts`:
 * `fromCrossJSON` на клієнті) з ТИМ САМИМ порядком плагінів, який будує
 * `getDefaultSerovalPlugins()` (`@tanstack/start-client-core`):
 * `[...serializationAdapters.map(makeSerovalPlugin), ...createDefaultSerovalPlugins()]`
 * (з 1.170 — через `getSerovalPlugins(routerPlugins)`; сервер підставляє
 * `defaultSerovalDeserializerPlugins` — ті самі плагіни з RawStream-
 * десеріалізатором попереду, тож для `Error` порядок той самий: адаптери
 * Start → `ShallowErrorPlugin`).
 *
 * 🔴 Пряме `getDefaultSerovalPlugins()` тут не годиться: воно читає
 * `getStartOptions()`, а той — `createIsomorphicFn()`-заглушку
 * (`@tanstack/start-fn-stubs`), яку замінює лише Vite-плагін Start; у vitest
 * (`@vitejs/plugin-react`, без `tanstackStart()`) вона ЗАВЖДИ повертає
 * `undefined`. Масив плагінів будуємо тим самим виразом руками — це не
 * копія логіки, а той самий вираз, підставлений напряму.
 */
const withAdapter = [
  makeSerovalPlugin(domainErrorAdapter),
  ...defaultSerovalPlugins,
] as unknown as SerovalPlugins;

async function roundTrip(error: Error, plugins: SerovalPlugins) {
  const node = await toCrossJSONAsync(error, { plugins });
  return fromCrossJSON<Error>(node, { plugins, refs: new Map() });
}

describe('domainErrorAdapter — реальна межа seroval (toCrossJSONAsync/fromCrossJSON)', () => {
  it('AdminConflictError kind unique: name+kind+constraint переживають межу', async () => {
    const src = Object.assign(new Error('конфлікт'), {
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'products_slug_key',
    });
    const out = await roundTrip(src, withAdapter);
    expect(out).toBeInstanceOf(Error);
    expect(out).toMatchObject({
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'products_slug_key',
    });
  });

  it('AdminConflictError kind reference: поля переживають межу', async () => {
    const src = Object.assign(new Error('конфлікт'), {
      name: 'AdminConflictError',
      kind: 'reference',
      constraint: 'order_items_product_id_fkey',
    });
    const out = await roundTrip(src, withAdapter);
    expect(out).toMatchObject({
      name: 'AdminConflictError',
      kind: 'reference',
      constraint: 'order_items_product_id_fkey',
    });
  });

  it('AdminConflictError kind state (Е5-9): поля переживають межу', async () => {
    const src = Object.assign(new Error('конфлікт'), {
      name: 'AdminConflictError',
      kind: 'state',
      constraint: 'order_cancelled_final',
    });
    const out = await roundTrip(src, withAdapter);
    expect(out).toBeInstanceOf(Error);
    expect(out).toMatchObject({
      name: 'AdminConflictError',
      kind: 'state',
      constraint: 'order_cancelled_final',
    });
  });

  it('AuthzError: name+operation переживають межу', async () => {
    const src = Object.assign(new Error('заборонено'), {
      name: 'AuthzError',
      operation: 'catalog.write',
    });
    const out = await roundTrip(src, withAdapter);
    expect(out).toMatchObject({
      name: 'AuthzError',
      operation: 'catalog.write',
    });
  });

  it('контроль БЕЗ адаптера: ShallowErrorPlugin лишає голий Error(message) — фіксує механіку дефекту Start', async () => {
    const src = Object.assign(new Error('конфлікт'), {
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'products_slug_key',
    });
    const out = await roundTrip(
      src,
      defaultSerovalPlugins as unknown as SerovalPlugins,
    );
    expect(out).toBeInstanceOf(Error);
    expect(out.name).toBe('Error');
    expect((out as unknown as { kind?: unknown }).kind).toBeUndefined();
    expect(
      (out as unknown as { constraint?: unknown }).constraint,
    ).toBeUndefined();
    expect(out.message).toBe('конфлікт');
  });

  it('генеричний Error (не з доменного переліку) не перехоплюється адаптером', async () => {
    const out = await roundTrip(new Error('щось інше'), withAdapter);
    expect(out.name).toBe('Error');
    expect(out.message).toBe('щось інше');
  });

  // Тема 12: ValidationError — єдина доменна помилка з НЕ-примітивним
  // payload. issues переживають межу, а нічого іншого (сирі повідомлення,
  // відлуння вводу) — ні.
  describe('ValidationError (Тема 12)', () => {
    const issues = [
      {
        path: ['quantities', 0, 'quantity'],
        code: 'too_big',
        params: { origin: 'number', maximum: 1_000_000 },
      },
      {
        path: ['prices', 1, 'price'],
        code: 'invalid_decimal',
        params: { precision: 12, scale: 2 },
      },
    ];
    const make = (extra: Record<string, unknown> = {}) =>
      Object.assign(new Error('[admin-server] помилка валідації вводу'), {
        name: 'ValidationError',
        issues,
        ...extra,
      });

    it('name і issues (path/code/params) переживають межу, без втрат і домішок', async () => {
      const out = await roundTrip(make(), withAdapter);
      expect(out).toBeInstanceOf(Error);
      expect(out.name).toBe('ValidationError');
      expect((out as unknown as { issues: unknown }).issues).toEqual(issues);
      // Нічого зайвого на обʼєкті: лише name/message/issues.
      expect(Object.keys(out).sort()).toEqual(['issues', 'name']);
    });

    it('білий список: сирі повідомлення, input, pattern і вкладені обʼєкти не летять', async () => {
      const dirty = make({
        issues: [
          {
            path: ['name'],
            code: 'too_small',
            message: 'Too small: expected string to have >=3 characters',
            input: 'введене-користувачем',
            pattern: '^secret$',
            params: {
              minimum: 3,
              origin: 'string',
              leak: 'x',
              nested: { a: 1 },
            },
          },
        ],
      });
      const out = await roundTrip(dirty, withAdapter);
      expect((out as unknown as { issues: unknown }).issues).toEqual([
        {
          path: ['name'],
          code: 'too_small',
          params: { minimum: 3, origin: 'string' },
        },
      ]);
      expect(JSON.stringify(out)).not.toContain('введене');
      expect(JSON.stringify(out)).not.toContain('secret');
    });

    it('невідомий код зводиться до custom', async () => {
      const out = await roundTrip(
        make({ issues: [{ path: [], code: 'attacker_code' }] }),
        withAdapter,
      );
      expect((out as unknown as { issues: unknown }).issues).toEqual([
        { path: [], code: 'custom' },
      ]);
    });

    it('контроль БЕЗ адаптера: ShallowErrorPlugin губить issues і name (сирий JSON знову)', async () => {
      const out = await roundTrip(
        make(),
        defaultSerovalPlugins as unknown as SerovalPlugins,
      );
      expect(out.name).toBe('Error');
      expect((out as unknown as { issues?: unknown }).issues).toBeUndefined();
    });
  });
});
