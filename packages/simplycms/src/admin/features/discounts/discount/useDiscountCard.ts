import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  discountsCollection,
  invalidateDiscountConsumers,
  useCollection,
} from 'simplycms/admin-data';
import { getDiscount, saveDiscount } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import type { Discount } from 'simplycms/schema/types';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { useSeedOnce } from '../../catalog-dictionaries/useSeedOnce';
import {
  emptyDiscountForm,
  toDiscountForm,
  toSaveInput,
} from './discount-form-mapping';
import {
  discountFormSchema,
  type DiscountFormInput,
  type DiscountFormValues,
} from './discount-form-schema';

export type DiscountForm = UseFormReturn<
  DiscountFormInput,
  unknown,
  DiscountFormValues
>;

/**
 * Стан картки знижки. Читання — `getDiscount` (знижка з цілями й умовами
 * одним узгодженим знімком), запис — ОДИН атомарний `saveDiscount`
 * (Е6в-16), далі write-back рядка в колекцію `discounts` і скидання
 * середовища цін адміна.
 */
export function useDiscountCard(
  discountId: string | undefined,
  groupId: string | undefined,
) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !discountId || discountId === 'new';
  const [newId] = useState(() => crypto.randomUUID()); // Е0: ключ генерує клієнт
  const id = isNew ? newId : discountId;
  const detailKey = entityKey(ENTITY.discounts).detail(id);

  // Підписка тримає sync колекції запущеним: без неї write-back нижче
  // впав би `SyncNotInitializedError` уже ПІСЛЯ закоміченого запису.
  const discounts = useCollection(discountsCollection);
  useLiveQuery({
    query: (q) => q.from({ d: discounts }).where(({ d }) => eq(d.id, id)),
  });

  // cache-sync-ok: це читання картки (queryFn), а не мутація
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => getDiscount({ data: { id } }),
    enabled: !isNew,
  });

  const form: DiscountForm = useForm({
    resolver: zodResolver(discountFormSchema),
    defaultValues: emptyDiscountForm(groupId),
  });
  const { reset } = form;
  // Рядок, яким засіяно форму: його дати пишуться, доки поле не змінене
  // (Е6в-22 ред.2) — навіть якщо фоновий refetch приніс новішу версію.
  const original = useRef<Discount | undefined>(undefined);
  useSeedOnce(detail.data?.discount.id, () => {
    if (!detail.data) return;
    original.current = detail.data.discount;
    reset(toDiscountForm(detail.data));
  });

  const onSubmit = async (v: DiscountFormValues) => {
    try {
      const res = await saveDiscount({
        data: toSaveInput(v, id, original.current),
      });
      discounts.utils.writeBatch(() => {
        discounts.utils.writeUpsert(res.discount);
      });
      queryClient.setQueryData(detailKey, res);
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    await invalidateDiscountConsumers(queryClient);
    toast.success(
      isNew ? t('admin.discounts.created') : t('admin.discounts.updated'),
    );
    void navigate({ to: adminPath('discounts') });
  };

  return {
    isNew,
    isLoading: !isNew && detail.isPending,
    notFound: !isNew && detail.isError,
    name: detail.data?.discount.name,
    form,
    onSubmit,
  };
}
