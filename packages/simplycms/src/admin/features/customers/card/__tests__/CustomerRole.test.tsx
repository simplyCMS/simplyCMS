// @vitest-environment jsdom
/** Картка покупця (Task 11, Е6г): роль, бан, видалення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  ADMIN_STATE_CONSTRAINT,
  DOMAIN_ERROR_NAME,
} from 'simplycms/contracts/domain-errors';
import {
  USER_ID,
  card,
  clientRef,
  mocks,
  renderCard,
  stubDom,
  ui,
} from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock((await import('./mocks')).mocks),
);
vi.mock('sonner', async () => {
  const { ui } = await import('./mocks');
  return { toast: { error: ui.toastError, success: ui.toastSuccess } };
});
vi.mock('@tanstack/react-router', async () => {
  const { ui } = await import('./mocks');
  return {
    useNavigate: () => ui.navigate,
    useParams: () => ({ userId: 'u0000000-0000-4000-8000-000000000001' }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  };
});
vi.mock('simplycms/core/hooks/useAuth', async () => {
  const { ui } = await import('./mocks');
  return { useAuth: () => ({ user: { id: ui.currentUserId } }) };
});

const t = createTranslator('uk');
const conflict = (constraint: string) =>
  Object.assign(new Error('conflict'), {
    name: DOMAIN_ERROR_NAME.adminConflict,
    kind: 'state',
    constraint,
  });
const roleSwitch = () =>
  screen.findByRole('switch', { name: t('admin.users.adminAccess') });

beforeEach(() => {
  stubDom();
  vi.clearAllMocks();
  ui.currentUserId = 'a0000000-0000-4000-8000-0000000000ff';
  mocks.getCustomerCard.mockResolvedValue(card());
  mocks.listUserCategories.mockResolvedValue([]);
  mocks.listOrders.mockResolvedValue([]);
});
afterEach(cleanup);

describe('роль адміністратора', () => {
  it('перемикач шле { admin: false } й інвалідовує [profiles]', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ isAdmin: true }));
    mocks.setAdminRole.mockResolvedValue({});
    renderCard();
    const sw = await roleSwitch();
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.click(sw);
    await waitFor(() =>
      expect(mocks.setAdminRole).toHaveBeenCalledWith({
        data: { userId: USER_ID, admin: false },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
    // Картку перечитано після інвалідації префікса.
    await waitFor(() =>
      expect(mocks.getCustomerCard.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('409 admin_role_last → тост «останній адміністратор»', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ isAdmin: true }));
    mocks.setAdminRole.mockRejectedValue(
      conflict(ADMIN_STATE_CONSTRAINT.adminRoleLast),
    );
    renderCard();
    fireEvent.click(await roleSwitch());
    await waitFor(() =>
      expect(ui.toastError).toHaveBeenCalledWith(
        t('admin.errors.adminRoleLast'),
      ),
    );
  });

  it('вимкнений для себе й для забаненого', async () => {
    ui.currentUserId = USER_ID;
    renderCard();
    expect((await roleSwitch()).hasAttribute('disabled')).toBe(true);
    cleanup();
    ui.currentUserId = 'a0000000-0000-4000-8000-0000000000ff';
    mocks.getCustomerCard.mockResolvedValue(card({ bannedAt: new Date() }));
    renderCard();
    expect((await roleSwitch()).hasAttribute('disabled')).toBe(true);
  });
});
