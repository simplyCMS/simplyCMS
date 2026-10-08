import { useQueryClient } from '@tanstack/react-query';
import { assignCustomerCategory } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';

export interface AssignInput {
  readonly categoryId: string;
  readonly reason: string;
  readonly locked: boolean;
}

/**
 * Ручне призначення категорії (К3-Е6в-4). Інвалідується префікс `[profiles]`
 * (Е6г-6): зачіпає картку, список і агрегати цін. Повертає `true` при успіху.
 */
export function useAssignCategory(userId: string) {
  const t = useT();
  const qc = useQueryClient();
  return async (input: AssignInput): Promise<boolean> => {
    try {
      await assignCustomerCategory({ data: { userId, ...input } });
      await qc.invalidateQueries({ queryKey: [ENTITY.profiles] });
      toast.success(t('admin.users.categoryChanged'));
      return true;
    } catch (e) {
      reportTxError(t, e);
      return false;
    }
  };
}
