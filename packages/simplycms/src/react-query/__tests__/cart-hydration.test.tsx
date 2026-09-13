// Гідраційний паритет кошика (К2-Е0, Е0-5). Сервер кошика не знає (він у
// localStorage), клієнт — знає з першого рендеру: до фіксу бейдж зʼявлявся
// в рендері гідратації як зайвий вузол → React #418 на кожній SSR-сторінці.
//
// 🔴 Дефолтне середовище vitest — node (без window): серверний прохід
// робиться в ньому, а DOM для клієнтського проходу ставиться вручну ПІСЛЯ
// (техніка `exposeDom` з packages/cli/src/theme-conformance-dom.mjs).
import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const STORED = JSON.stringify([
  { productId: 'p1', modificationId: null, name: 'A', price: 100, quantity: 2 },
]);

function exposeDom(window: JSDOM['window']): void {
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => window[key as keyof typeof window],
    });
  }
  for (const [key, value] of Object.entries({
    window,
    self: window,
    document: window.document,
    navigator: window.navigator,
    localStorage: window.localStorage,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
}

describe('кошик: SSR-розмітка гідрується без розбіжностей при непорожньому localStorage', () => {
  it('нуль recoverable errors, бейдж зʼявляється ПІСЛЯ гідратації, hydrated false→true', async () => {
    const { CartProvider, useCart } = await import('../useCart');
    const hydratedLog: boolean[] = [];
    function Badge() {
      const { totalItems, hydrated } = useCart();
      hydratedLog.push(hydrated);
      return totalItems > 0 ? <span data-badge="">{totalItems}</span> : null;
    }
    const tree = (
      <CartProvider>
        <div id="root">
          <Badge />
        </div>
      </CartProvider>
    );

    // 1. Сервер: window немає, кошик порожній, hydrated === false.
    const html = renderToString(tree);
    expect(html).not.toContain('data-badge');
    expect(hydratedLog.at(0)).toBe(false);

    // 2. Клієнт: DOM + непорожній localStorage до першого рендеру.
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
      url: 'http://localhost/',
    });
    exposeDom(dom.window);
    window.localStorage.setItem('simplycms-cart', STORED);
    const { hydrateRoot } = await import('react-dom/client');
    const recoverable: unknown[] = [];
    const container = document.body;
    await act(async () => {
      hydrateRoot(container, tree, {
        onRecoverableError: (e) => recoverable.push(e),
      });
    });

    expect(
      recoverable,
      `React повідомив про розбіжність: ${recoverable.map(String).join('\n')}`,
    ).toEqual([]);
    expect(container.querySelector('[data-badge]')?.textContent).toBe('2');
    // Перший клієнтський рендер (гідратація) МУСИТЬ збігтися з серверним —
    // hydrated === false; лише ПІСЛЯ commit CartProvider перечитує
    // localStorage і рендер повторюється з hydrated === true (рішення А).
    expect(hydratedLog.at(1)).toBe(false);
    expect(hydratedLog.at(-1)).toBe(true);
  });
});
