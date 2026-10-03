// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { ROWS, wrapper } from './render-support';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const { listSections, removeSections } = vi.hoisted(() => ({
  listSections: vi.fn(),
  removeSections: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listSections, removeSections }),
);

import SectionsPage from '../SectionsPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  listSections.mockResolvedValue(ROWS);
});
afterEach(() => cleanup());

describe('SectionsPage', () => {
  it('рядки за sortOrder; мініатюра через resolveMediaUrl, а не сирий референс', async () => {
    render(<SectionsPage />, { wrapper });
    await screen.findByText('Ноутбуки');
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/media/section/x/a.jpg');
    expect(screen.getByText(t('admin.sections.inactive'))).toBeTruthy();
  });

  it('діалог видалення містить admin.sections.deleteWarning', async () => {
    render(<SectionsPage />, { wrapper });
    await screen.findByText('Ноутбуки');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[0]!);
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.sections.deleteWarning')),
    ).toBeTruthy();
  });

  it('підтвердження → removeSections з id, тост успіху', async () => {
    removeSections.mockResolvedValue(undefined);
    render(<SectionsPage />, { wrapper });
    await screen.findByText('Телефони');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[1]!);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }));
    await waitFor(() => expect(removeSections).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t('admin.sections.deleted')),
    );
  });
});
