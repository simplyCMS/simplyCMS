// @vitest-environment jsdom
/**
 * Тема 12: серверна відмова валідації залишку (>1 000 000) — помилка ПОЛЯ
 * локалізованою мовою, а не сирий JSON у загальному тості (борг №15).
 * Помилка проходить РЕАЛЬНУ межу serverFn (seroval + `domainErrorAdapter`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'simplycms/i18n';
import {
  serverValidationError,
  throughServerFnBoundary,
} from '../../../../lib/__tests__/support/serverfn-boundary';
import { StockEditor } from '../StockEditor';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  save: vi.fn(),
  points: [] as Array<{
    id: string;
    name: string;
    city: string;
    is_system: boolean;
  }>,
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock('simplycms/core/hooks/useStock', () => ({
  usePickupPoints: () => ({ data: mocks.points }),
  usePickupPointsCount: () => ({ data: mocks.points.length }),
}));
vi.mock('../useStock', () => ({
  useStock: () => ({ rows: [], save: mocks.save }),
}));

const issue = {
  path: ['quantities', 0, 'quantity'],
  code: 'too_big',
  params: { origin: 'number', maximum: 1_000_000 },
} as const;

afterEach(() => {
  cleanup();
  mocks.toastError.mockClear();
  mocks.save.mockReset();
});

function setup(points: typeof mocks.points) {
  mocks.points = points;
  return render(
    <I18nProvider locale="uk">
      <StockEditor productId="p" modificationId={null} showCard={false} />
    </I18nProvider>,
  );
}

describe('StockEditor: помилки валідації сервера → поле', () => {
  it('один склад: 1000001 → повідомлення під полем, без тосту й без сирого JSON', async () => {
    mocks.save.mockRejectedValue(
      await throughServerFnBoundary(serverValidationError([issue])),
    );
    setup([{ id: 'pp-1', name: 'Склад', city: 'Київ', is_system: true }]);
    const user = userEvent.setup();

    const input = screen.getByLabelText('Кількість на складі');
    await user.clear(input);
    await user.type(input, '1000001');
    await user.click(screen.getByRole('button', { name: 'Зберегти залишки' }));

    const msg = await screen.findByText('Значення завелике: не більше 1000000');
    expect(msg).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(msg.id);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/"code"|"path"|\[\s*\{/);
  });

  it('кілька складів: помилка прив’язується до рядка потрібної точки за індексом path', async () => {
    mocks.save.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([
          { ...issue, path: ['quantities', 1, 'quantity'] },
        ]),
      ),
    );
    setup([
      { id: 'a', name: 'Склад А', city: 'Київ', is_system: false },
      { id: 'b', name: 'Склад Б', city: 'Львів', is_system: false },
    ]);
    const user = userEvent.setup();

    await user.type(document.getElementById('stock-quantity-b')!, '5');
    await user.click(screen.getByRole('button', { name: 'Зберегти залишки' }));

    const msg = await screen.findByText('Значення завелике: не більше 1000000');
    expect(msg.id).toBe('stock-quantity-b-error');
    expect(
      document.getElementById('stock-quantity-a')!.getAttribute('aria-invalid'),
    ).toBe('false');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('правка поля прибирає його помилку', async () => {
    mocks.save.mockRejectedValue(
      await throughServerFnBoundary(serverValidationError([issue])),
    );
    setup([{ id: 'pp-1', name: 'Склад', city: 'Київ', is_system: true }]);
    const user = userEvent.setup();
    const input = screen.getByLabelText('Кількість на складі');
    await user.type(input, '9');
    await user.click(screen.getByRole('button', { name: 'Зберегти залишки' }));
    await screen.findByText('Значення завелике: не більше 1000000');

    await user.type(input, '1');

    expect(
      screen.queryByText('Значення завелике: не більше 1000000'),
    ).toBeNull();
  });

  it('проблема без поля (правило рівня запиту) → один загальний локалізований тост', async () => {
    mocks.save.mockRejectedValue(
      await throughServerFnBoundary(
        serverValidationError([{ path: [], code: 'custom' }]),
      ),
    );
    setup([{ id: 'pp-1', name: 'Склад', city: 'Київ', is_system: true }]);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Кількість на складі'), '1');
    await user.click(screen.getByRole('button', { name: 'Зберегти залишки' }));

    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
      ),
    );
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  it('контроль без адаптера: помилка поля НЕ з’являється (клієнт бачить голий Error)', async () => {
    mocks.save.mockRejectedValue(
      await throughServerFnBoundary(serverValidationError([issue]), {
        registered: false,
      }),
    );
    setup([{ id: 'pp-1', name: 'Склад', city: 'Київ', is_system: true }]);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Кількість на складі'), '1');
    await user.click(screen.getByRole('button', { name: 'Зберегти залишки' }));

    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText('Значення завелике: не більше 1000000'),
    ).toBeNull();
  });
});
