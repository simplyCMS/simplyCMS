// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CustomerStatsCard from '../CustomerStatsCard';
import { card } from './render-support';
import { TestI18nProvider, ukT } from '../../../../../../test-harness/i18n';

vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (n: number) => String(n),
}));

const t = ukT;
const show = (over: Record<string, unknown>) =>
  render(
    <TestI18nProvider>
      <CustomerStatsCard card={card(over) as never} />
    </TestI18nProvider>,
  );

/** Р30: правило email_domain не бачить домену непідтвердженої пошти — адмін це бачить. */
describe('CustomerStatsCard: домен пошти (Р30)', () => {
  afterEach(cleanup);

  it('непідтверджена пошта — домен із позначкою «не підтверджено»', () => {
    show({ emailVerified: false });
    expect(
      screen.getByText(
        t('admin.users.emailDomainUnverified', { domain: 'shop.test' }),
      ),
    ).toBeTruthy();
  });

  it('підтверджена — чистий домен без позначки', () => {
    show({ emailVerified: true });
    expect(screen.getByText('shop.test')).toBeTruthy();
    expect(screen.queryByText(/не підтверджено/)).toBeNull();
  });
});
