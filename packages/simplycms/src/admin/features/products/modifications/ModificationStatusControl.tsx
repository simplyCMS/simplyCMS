import { eq, useLiveQuery } from '@tanstack/react-db';
import type { UseFormReturn } from 'react-hook-form';
import {
  productModificationsCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';
import { reportTxError } from '../../../lib/report-tx-error';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import type { ModificationFormValues } from './modification-form-schema';

interface Props {
  /** `null` — створення (статус іде у формі, живого рядка ще нема). */
  readonly mod: ProductModification | null;
  readonly form: UseFormReturn<ModificationFormValues>;
}

/**
 * Статус наявності модифікації — виніс із `ModificationDialog.tsx` (канон
 * 150 рядків). 🔴 МAJOR (рев'ю хвилі C): при РЕДАГУВАННІ — окремий
 * контрол із МИТТЄВИМ збереженням над живим рядком (`mods.update`
 * напряму), не поле форми — інакше стейл `defaultValues` RHF переписав би
 * статус, щойно виставлений цим самим контролом чи `saveStock`, наступним
 * Save. При СТВОРЕННІ живого рядка ще нема — статус іде у формі й у
 * `insert` (`useModifications.create`).
 */
export function ModificationStatusControl({ mod, form }: Props) {
  const t = useT();
  const mods = useCollection(productModificationsCollection);
  const { data: liveMod } = useLiveQuery(
    (q) =>
      mod
        ? q
            .from({ m: mods })
            .where(({ m }) => eq(m.id, mod.id))
            .findOne()
        : undefined,
    [mod?.id],
  );

  if (mod) {
    if (!liveMod) return null;
    return (
      <StockStatusSelect
        value={liveMod.stockStatus ?? 'in_stock'}
        onChange={(v) => {
          // 🔴 Item 2: без .catch — відхилена мутація тихо відкочується
          // (бібліотека сама) і лишає unhandled rejection у консолі.
          const tx = mods.update(mod.id, (d) => {
            d.stockStatus = v;
          });
          tx.isPersisted.promise.catch((e: unknown) => reportTxError(t, e));
        }}
      />
    );
  }

  return (
    <StockStatusSelect
      value={form.watch('stockStatus') ?? 'in_stock'}
      onChange={(v) => form.setValue('stockStatus', v, { shouldDirty: true })}
    />
  );
}
