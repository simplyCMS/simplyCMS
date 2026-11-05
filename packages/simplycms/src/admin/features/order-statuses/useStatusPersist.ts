import { useState } from 'react';
import { toast } from 'sonner';
import {
  createOrderStatus,
  saveOrderStatus,
  setDefaultOrderStatus,
} from 'simplycms/admin-server';
import { useT, type Translator } from 'simplycms/i18n';
import { adminErrorKey } from '../../lib/admin-error';
import { applyServerValidation } from '../../lib/apply-server-validation';
import { textsDiff } from '../translations/texts-diff';
import { textsErrorField } from '../translations/texts-errors';
import type { TextsForm } from '../translations/texts-form';
import { useAggregateCommand } from '../translations/useAggregateCommand';
import { STATUS_FIELDS, type StatusBaseForm } from './form-data';

type Texts = TextsForm<'name'>;

interface Options {
  /** Редагований статус; `null` — створення. */
  readonly editing: { id: string; isDefault: boolean } | null;
  /** Стан, з яким порівнюється форма (останній `order-statuses.get`). */
  readonly baseline: { base: StatusBaseForm; texts: Texts };
  /** Ключ нового статусу генерує форма наперед: повтор «Створити» не дублює рядок. */
  readonly newId: string;
  readonly nextSortOrder: number;
  readonly onConflict: () => void;
  /** Запис відбувся (повністю чи частково): сторінка перечитує список. */
  readonly onChanged: () => void;
  /** Усе збережено: діалог закривається. */
  readonly onDone: () => void;
  readonly setFormError: (name: string, message: string) => void;
}

function report(
  e: unknown,
  t: Translator,
  setFormError: Options['setFormError'],
) {
  const rest = applyServerValidation(
    e,
    (field, err) => setFormError(field, err.message),
    { t, fieldFor: (p) => textsErrorField(p) },
  );
  if (rest === null) {
    const key = adminErrorKey(e);
    toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
  } else toast.error(t('admin.validation.failed'));
}

/**
 * Збереження статусу командами агрегата: редагування — ОДИН `saveOrderStatus` із різницею
 * (колір + змінені вкладки мов), далі за потреби `setDefault` (міняє N рядків, окрема команда);
 * створення — `createOrderStatus` з усіма наповненими мовами. Конфлікт версії (412) обробляє
 * `useAggregateCommand`; помилки валідації лягають на поля вкладок, форма не скидається.
 */
export function useStatusPersist(o: Options) {
  const t = useT();
  const [isSubmitting, setSubmitting] = useState(false);
  const save = useAggregateCommand(saveOrderStatus, {
    onConflict: o.onConflict,
  });
  const setDefault = useAggregateCommand(setDefaultOrderStatus, {
    onConflict: o.onConflict,
  });

  const edit = async (base: StatusBaseForm, texts: Texts, id: string) => {
    const patch = textsDiff(STATUS_FIELDS, o.baseline.texts, texts);
    const colorChanged = base.color !== o.baseline.base.color;
    const wantDefault = base.isDefault && !o.editing!.isDefault;
    if (!colorChanged && Object.keys(patch).length === 0 && !wantDefault) {
      toast.info(t('admin.translations.nothingToSave'));
      return;
    }
    try {
      if (colorChanged || Object.keys(patch).length > 0) {
        const out = await save.run({
          id,
          ...(colorChanged && { base: { color: base.color } }),
          ...(Object.keys(patch).length > 0 && { texts: patch }),
        });
        if (!out) return o.onChanged();
      }
      if (wantDefault) {
        const out = await setDefault.run({ id });
        if (!out) return o.onChanged();
      }
      toast.success(t('common.statusUpdated'));
      o.onChanged();
      o.onDone();
    } catch (e) {
      // Збій (зокрема 409 `concurrent_change`) — список перечитується, не повторюється наосліп.
      o.onChanged();
      report(e, t, o.setFormError);
    }
  };

  const create = async (base: StatusBaseForm, texts: Texts) => {
    const filled: Record<string, { name: string }> = {};
    for (const [l, row] of Object.entries(texts))
      if (row.name !== '') filled[l] = { name: row.name };
    let created = false;
    try {
      // cache-sync-ok: сторінка інвалідує колекцію через `onChanged`
      const out = await createOrderStatus({
        data: {
          id: o.newId,
          code: base.code,
          color: base.color,
          sortOrder: o.nextSortOrder,
          texts: filled,
        },
      });
      created = true;
      toast.success(t('admin.orders.statuses.created'));
      if (base.isDefault) {
        // Статус уже існує: збій дефолту — окрема помилка, діалог закривається (повторне
        // «Створити» з тим самим id впиралось би в дубль ключа).
        try {
          // cache-sync-ok: сторінка інвалідує колекцію через `onChanged`
          await setDefaultOrderStatus({
            data: { id: o.newId, expectedVersion: out.version },
          });
        } catch (e) {
          report(e, t, o.setFormError);
        }
      }
      o.onChanged();
      o.onDone();
    } catch (e) {
      if (created) o.onChanged();
      report(e, t, o.setFormError);
    }
  };

  return {
    isSubmitting,
    submit: async (base: StatusBaseForm, texts: Texts) => {
      setSubmitting(true);
      try {
        await (o.editing
          ? edit(base, texts, o.editing.id)
          : create(base, texts));
      } finally {
        setSubmitting(false);
      }
    },
  };
}
