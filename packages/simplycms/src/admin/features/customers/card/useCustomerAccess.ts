import { useQueryClient } from '@tanstack/react-query';
import { setAdminRole, setCustomerBan } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';

/**
 * Роль і бан з картки (Е6г-4, Е6г-11). Відмови сервера (409 `admin_role_*`,
 * `customer_is_admin`) — локалізований тост через `adminErrorKey`; успіх
 * інвалідує префікс `[profiles]` (картка, список, агрегати цін, Е6г-6).
 */
export function useCustomerAccess(userId: string) {
  const t = useT();
  const qc = useQueryClient();
  const changeRole = async (admin: boolean): Promise<boolean> => {
    try {
      await setAdminRole({ data: { userId, admin } });
      await qc.invalidateQueries({ queryKey: [ENTITY.profiles] });
      toast.success(
        t(admin ? 'admin.users.adminGranted' : 'admin.users.adminRevoked'),
      );
      return true;
    } catch (e) {
      reportTxError(t, e);
      return false;
    }
  };
  const changeBan = async (
    banned: boolean,
    reason?: string,
  ): Promise<boolean> => {
    try {
      await setCustomerBan({
        data: { userId, banned, ...(reason ? { reason } : {}) },
      });
      await qc.invalidateQueries({ queryKey: [ENTITY.profiles] });
      toast.success(
        t(banned ? 'admin.users.card.bannedDone' : 'admin.users.card.unbanned'),
      );
      return true;
    } catch (e) {
      reportTxError(t, e);
      return false;
    }
  };
  return { changeRole, changeBan };
}
