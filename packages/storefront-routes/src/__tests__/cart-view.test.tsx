// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@simplycms/i18n';
import {
  CART_REQUISITES,
  REQUIRED_REQUISITES,
  type CartSlots,
} from '@simplycms/objects/views';
import { cartViewModelFixtures } from '@simplycms/objects/views/fixtures';

/**
 * Conformance-прогін канонічного `CartView` на фікстурах (контракт тем v3,
 * Фаза 5, Step 3) — до появи kit-а Фази 6.
 *
 * 🔴 Це водночас ДОКАЗ чистоти view: провайдер тут рівно один — i18n. Ні
 * supabase-клієнта, ні QueryClient, ні `CartProvider` немає, тож будь-який
 * запит чи звернення до кошика всередині view впало б тут, а не в проді.
 *
 * 🔴 На відміну від ProductDetail/Catalog, крайній стан (`itemCount: 0`)
 * структурно ЗАБИРАЄ весь блок реквізитів — сторінка показує зовсім іншу
 * розмітку (порожній кошик), а не той самий слот у порожньому стані. Тому
 * перевірку «всі обовʼязкові реквізити присутні» тут не дублюють на обидва
 * стани (як у Ф3/Ф4) — на `edge` асертується протилежне: реквізитів немає
 * взагалі, і сторінка не падає.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { CartView } from '../views/CartView';

/** Стаб реквізиту: тільки маркер — рівно те, що шукатиме kit Фази 6. */
function requisiteStub(name: string) {
  return function RequisiteStub() {
    return <div data-simplycms-requisite={name} />;
  };
}

const stubSlots: CartSlots = {
  Items: requisiteStub(CART_REQUISITES.Items),
  ClearCart: requisiteStub(CART_REQUISITES.ClearCart),
  Summary: requisiteStub(CART_REQUISITES.Summary),
  Checkout: requisiteStub(CART_REQUISITES.Checkout),
};

function renderCart(state: 'full' | 'edge') {
  return render(
    <I18nProvider locale="uk">
      <CartView {...cartViewModelFixtures[state]} slots={stubSlots} />
    </I18nProvider>,
  );
}

function requisitesOf(container: HTMLElement): (string | null)[] {
  return Array.from(
    container.querySelectorAll('[data-simplycms-requisite]'),
  ).map((node) => node.getAttribute('data-simplycms-requisite'));
}

describe('CartView — канонічний view на фікстурах', () => {
  afterEach(cleanup);

  it('повний стан: крихти — лінк на головну, остання ланка текстом', () => {
    const { container } = renderCart('full');

    const links = Array.from(container.querySelectorAll('nav a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
    expect(container.querySelector('nav span')?.textContent).toBe('Кошик');
  });

  it('повний стан: усі обовʼязкові реквізити розставлені', () => {
    const { container } = renderCart('full');

    expect(requisitesOf(container)).toEqual(
      expect.arrayContaining([...REQUIRED_REQUISITES.Cart]),
    );
  });

  it('повний стан: ClearCart теж розставлено, хоч і не обовʼязковий', () => {
    const { container } = renderCart('full');

    expect(requisitesOf(container)).toContain(CART_REQUISITES.ClearCart);
  });

  it('крайній стан: порожній кошик — жодного реквізиту, показано заглушку', () => {
    const { container, getByText } = renderCart('edge');

    expect(requisitesOf(container)).toEqual([]);
    expect(getByText('Кошик порожній')).not.toBeNull();
  });
});
