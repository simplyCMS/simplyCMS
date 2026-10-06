import { useLiveQuery, eq } from '@tanstack/react-db';
import {
  shippingRatesCollection,
  shippingZonesCollection,
  useCollection,
} from 'simplycms/admin-data';
import type { ShippingRate } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';
import type { ShippingRateFormValues } from './shipping-rate-form-schema';

const num = (s: string) => s || null;

/**
 * Тарифи способу (Е6а-1): on-demand зріз `methodId` + зони для вибору.
 * Запис — через колекцію; `zoneId` лише в insert (`insertOnly`), перенос
 * тарифу в іншу зону — це новий тариф.
 */
export function useShippingRates(methodId: string) {
  const t = useT();
  const rates = useCollection(shippingRatesCollection);
  const zonesCollection = useCollection(shippingZonesCollection);
  const { data: rows } = useLiveQuery({
    query: (q) =>
      q
        .from({ r: rates })
        .where(({ r }) => eq(r.methodId, methodId))
        .orderBy(({ r }) => r.sortOrder, 'asc'),
  });
  const { data: zones } = useLiveQuery({
    query: (q) => q.from({ z: zonesCollection }),
  });

  const save = async (
    rate: ShippingRate | undefined,
    v: ShippingRateFormValues,
  ) => {
    const patch = {
      name: v.name,
      calculationType: v.calculationType,
      baseCost: v.baseCost,
      perKgCost: num(v.perKgCost),
      minWeight: num(v.minWeight),
      freeFromAmount: num(v.freeFromAmount),
      minOrderAmount: num(v.minOrderAmount),
      maxOrderAmount: num(v.maxOrderAmount),
      estimatedDays: num(v.estimatedDays),
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    };
    const tx = rate
      ? rates.update(rate.id, (d) => Object.assign(d, patch))
      : rates.insert({
          id: crypto.randomUUID(), // Е0: ключ генерує клієнт
          methodId,
          zoneId: v.zoneId,
          config: {},
          createdAt: new Date(),
          ...patch,
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return false;
    }
    toast.success(
      rate ? t('common.changesSaved') : t('admin.shipping.rates.added'),
    );
    return true;
  };

  const remove = (id: string) =>
    rates
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.shipping.rates.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));

  return { rows, zones, save, remove };
}
