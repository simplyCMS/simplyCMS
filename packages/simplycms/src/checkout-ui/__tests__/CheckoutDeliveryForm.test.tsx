// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Довідник — керований з тесту: порожній (стан демо-магазину без доставки до
// К2-Е0: форма мовчала, submit лишався активним) або один pickup з однією
// точкою (стан покупного демо: точку треба обрати самому — ще одна «стіна»).
const directory = vi.hoisted(() => ({
  methods: [] as unknown[],
  pickupPoints: [] as unknown[],
}));
vi.mock('simplycms/core/hooks/useShippingDirectory', () => ({
  useShippingDirectory: () => ({
    methods: directory.methods,
    pickupPoints: directory.pickupPoints,
    zones: [],
    rates: [],
    isLoading: false,
    rateFor: () => ({ cost: 0 }),
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
  type: 'system',
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

describe('CheckoutDeliveryForm', () => {
  it('без способів доставки — empty-state, submit неможливий, жодного radio', () => {
    directory.methods = [];
    directory.pickupPoints = [];
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
});
