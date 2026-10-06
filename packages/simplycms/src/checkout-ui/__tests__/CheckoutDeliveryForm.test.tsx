// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Довідник — керований з тесту: порожній (стан демо-магазину без доставки до
// К2-Е0: форма мовчала, submit лишався активним) або один pickup з однією
// точкою (стан покупного демо: точку треба обрати самому — ще одна «стіна»).
const directory = vi.hoisted(() => ({
  methods: [] as unknown[],
  pickupPoints: [] as unknown[],
  rate: { cost: 0, pricing: 'rates' } as { cost: number; pricing: string },
}));
vi.mock('simplycms/core/hooks/useShippingDirectory', () => ({
  useShippingDirectory: () => ({
    methods: directory.methods,
    pickupPoints: directory.pickupPoints,
    zones: [],
    rates: [],
    isLoading: false,
    rateFor: () => directory.rate,
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('simplycms/core/hooks/useAddressBook', () => ({
  useAddressBook: () => ({ addresses: [], save: vi.fn() }),
}));
vi.mock('simplycms/react-query', async (orig) => ({
  ...(await orig()),
  useEngine: () => ({ config: { locale: 'uk-UA', currency: 'UAH' } }),
}));

import { I18nProvider } from 'simplycms/i18n';
import { CheckoutDeliveryForm } from '../CheckoutDeliveryForm';
import { expectLabelledControls } from './accessible-controls';

const PICKUP = {
  id: 'm1',
  code: 'pickup',
  name: 'Самовивіз',
  description: null,
  icon: null,
  provider: 'core:pickup',
  pricing: 'rates',
  is_active: true,
  sort_order: 0,
};
const POINT = {
  id: 'p1',
  method_id: 'm1',
  name: 'Склад',
  address: 'вул. 1',
  city: 'Київ',
  is_active: true,
  sort_order: 0,
};

const renderForm = (
  values: Record<string, string | boolean>,
  extra: Record<string, unknown> = {},
) => {
  const onChange = vi.fn();
  const onAvailabilityChange = vi.fn();
  render(
    <I18nProvider locale="uk">
      <CheckoutDeliveryForm
        values={values}
        onChange={onChange}
        subtotal={100}
        onAvailabilityChange={onAvailabilityChange}
        {...extra}
      />
    </I18nProvider>,
  );
  return { onChange, onAvailabilityChange };
};

afterEach(cleanup);

describe('CheckoutDeliveryForm', () => {
  it('без способів доставки — empty-state, submit неможливий, жодного radio', () => {
    directory.methods = [];
    directory.pickupPoints = [];
    directory.rate = { cost: 0, pricing: 'rates' };
    const { onAvailabilityChange } = renderForm({});
    expect(screen.getByText('Доставка не налаштована')).toBeTruthy();
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('єдина точка pickup обирається сама; контроли мають лейбли', () => {
    directory.methods = [PICKUP];
    directory.pickupPoints = [POINT];
    const { onChange, onAvailabilityChange } = renderForm({
      shippingMethodId: 'm1',
    });
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledWith('pickupPointId', 'p1');
    expect(screen.getByLabelText(/Оберіть пункт самовивозу/)).toBeTruthy();
    expectLabelledControls(document.body);
  });

  // 🔴 Негативний контроль безвиході, у яку покупець заганяв себе кліками:
  // обрав самовивіз (точка підставилась сама) → перемкнувся на курʼєра.
  // Сервер має власний предикат на «курʼєр із точкою» (`prepareCheckout`:
  // `!isPickup && input.pickupPointId` → `pickup_point_invalid`), а
  // інтерфейсу ЗНЯТИ точку не існує — випадайка для не-pickup прихована.
  // Без скидання квота відмовляла назавжди і submit був мертвий без підказки.
  it('точка ЧУЖОГО методу скидається при переході на курʼєра', () => {
    directory.methods = [
      PICKUP,
      {
        ...PICKUP,
        id: 'm2',
        code: 'courier',
        name: 'Курʼєр',
        provider: 'core:address',
      },
    ];
    directory.pickupPoints = [POINT];
    const { onChange } = renderForm({
      shippingMethodId: 'm2',
      pickupPointId: 'p1',
    });
    expect(onChange).toHaveBeenCalledWith('pickupPointId', '');
  });

  // Е6а-9: самовивіз визначає провайдер, а не `code` — довільний код способу
  // з провайдером `core:pickup` усе одно показує вибір точки.
  it('спосіб core:pickup з довільним code показує вибір точки', () => {
    directory.methods = [{ ...PICKUP, code: 'my-warehouse' }];
    directory.pickupPoints = [POINT, { ...POINT, id: 'p2', name: 'Магазин' }];
    renderForm({ shippingMethodId: 'm1' });
    expect(screen.getByLabelText(/Оберіть пункт самовивозу/)).toBeTruthy();
  });

  it('code «pickup» в адресного провайдера не дає вибору точки', () => {
    directory.methods = [{ ...PICKUP, provider: 'core:address' }];
    directory.pickupPoints = [POINT];
    renderForm({ shippingMethodId: 'm1' });
    expect(screen.queryByLabelText(/Оберіть пункт самовивозу/)).toBeNull();
  });

  // Е6а-4: carrier не «Безкоштовно» — вартість визначить перевізник.
  it('режим carrier показує «За тарифами перевізника» замість суми', () => {
    directory.methods = [{ ...PICKUP, provider: 'core:address' }];
    directory.pickupPoints = [];
    directory.rate = { cost: 0, pricing: 'carrier' };
    renderForm({ shippingMethodId: 'm1' });
    expect(screen.getByText('За тарифами перевізника')).toBeTruthy();
    expect(screen.queryByText('Безкоштовно')).toBeNull();
  });
});
