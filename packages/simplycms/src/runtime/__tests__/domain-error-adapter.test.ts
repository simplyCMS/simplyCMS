import { describe, expect, it } from 'vitest';
import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from '@tanstack/router-core';
import { fromCrossJSON, toCrossJSONAsync } from 'seroval';
import type { Plugin } from 'seroval';
import { domainErrorAdapter } from '../domain-error-adapter';

/**
 * Е3-20: перетинає РЕАЛЬНУ межу serverFn — той самий механізм, яким Start
 * (де)серіалізує відповідь server function (`server-functions-handler.ts`:
 * `toCrossJSONStream`/`toCrossJSONAsync` на сервері; `serverFnFetcher.ts`:
 * `fromCrossJSON` на клієнті) з ТИМ САМИМ порядком плагінів, який будує
 * `getDefaultSerovalPlugins()` (`@tanstack/start-client-core`):
 * `[...serializationAdapters.map(makeSerovalPlugin), ...defaultSerovalPlugins]`.
 *
 * 🔴 Пряме `getDefaultSerovalPlugins()` тут не годиться: воно читає
 * `getStartOptions()`, а той — `createIsomorphicFn()`-заглушку
 * (`@tanstack/start-fn-stubs`), яку замінює лише Vite-плагін Start; у vitest
 * (`@vitejs/plugin-react`, без `tanstackStart()`) вона ЗАВЖДИ повертає
 * `undefined`. Масив плагінів будуємо тим самим виразом руками — це не
 * копія логіки, а той самий вираз, підставлений напряму.
 */
const withAdapter: Plugin<any, any>[] = [
  makeSerovalPlugin(domainErrorAdapter),
  ...defaultSerovalPlugins,
];

async function roundTrip(error: Error, plugins: Plugin<any, any>[]) {
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
      defaultSerovalPlugins as Plugin<any, any>[],
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
});
