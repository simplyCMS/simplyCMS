// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import CustomerStatsCard from '../CustomerStatsCard';
import { card } from './render-support';

vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (n: number) => String(n),
}));

const t = createTranslator('uk');
const show = (over: Record<string, unknown>) =>
  render(
    <I18nProvider locale="uk">
      <CustomerStatsCard card={card(over) as never} />
    </I18nProvider>,
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
