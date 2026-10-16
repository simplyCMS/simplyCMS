// @vitest-environment jsdom
/**
 * Таблиця модифікацій чернетки: назва мовою вкладки, серверна помилка рядка,
 * видалення й порядок працюють з чернеткою, а не з мережею.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResizeObserverStub } from '../../edit/__tests__/test-engine-stub';
import { CardHarness, mod, PRODUCT_ID } from '../../__tests__/card-harness';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);

import { ModificationsPanel } from '../ModificationsPanel';

const A = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const B = '22222222-2222-4222-8222-bbbbbbbbbbbb';
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const mods = [
  mod(A, 'Перша', { texts: { uk: 'Перша', en: 'First' } }),
  mod(B, 'Друга', { sortOrder: 1 }),
];
const renderPanel = (card = {}, active = 'uk') =>
  render(
    <CardHarness values={{ modifications: mods }} card={card} active={active}>
      <ModificationsPanel productId={PRODUCT_ID} sectionId={null} />
    </CardHarness>,
  );

describe('ModificationsTable (чернетка)', () => {
  it('назва мовою активної вкладки, з фолбеком на основну', () => {
    renderPanel({}, 'en');
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Друга')).toBeTruthy();
  });

  it('серверна помилка рядка показана біля його назви', () => {
    renderPanel({ modificationErrors: { [B]: 'Токен зайнятий' } });
    expect(screen.getByRole('alert').textContent).toBe('Токен зайнятий');
  });

  it('видалення з підтвердженням прибирає рядок із чернетки', async () => {
    const user = userEvent.setup();
    renderPanel();
    const row = screen.getByText('Друга').closest('tr')!;
    await user.click(row.querySelectorAll('button')[2]!);
    await user.click(
      await screen.findByRole('button', { name: 'Видалити', hidden: false }),
    );
    expect(screen.queryByText('Друга')).toBeNull();
  });

  it('стрілка «вниз» міняє рядки місцями', () => {
    renderPanel();
    const first = screen.getByText('Перша').closest('tr')!;
    fireEvent.click(first.querySelectorAll('button')[1]!);
    const names = [...document.querySelectorAll('tbody tr')].map(
      (r) => r.querySelectorAll('td')[2]?.textContent,
    );
    expect(names[0]).toContain('Друга');
  });
});
