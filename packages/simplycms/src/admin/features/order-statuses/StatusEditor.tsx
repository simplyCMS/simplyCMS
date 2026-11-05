import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { DialogFooter } from 'simplycms/ui/dialog';
import { ConflictDialog } from '../translations/ConflictDialog';
import { LanguageTabs } from '../translations/LanguageTabs';
import type { LanguageInfo } from '../translations/translation-context';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../translations/useAggregateCommand';
import { generateStatusCode } from './form-data';
import { StatusBaseFields } from './StatusBaseFields';
import { useStatusPersist } from './useStatusPersist';
import {
  useStatusForm,
  type StatusAggregate,
  type StatusEditing,
} from './useStatusForm';

export interface StatusEditorProps {
  readonly editing: StatusEditing | null;
  /** Завантажений агрегат (редагування) або порожній (створення). */
  readonly aggregate: StatusAggregate;
  readonly languages: readonly LanguageInfo[];
  readonly refetch: () => Promise<StatusAggregate | undefined>;
  readonly nextSortOrder: number;
  readonly onChanged: () => void;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

/** Форма статусу: вкладки мов (тексти), код, колір, дефолт. Версія агрегата — у контексті. */
function Body(p: StatusEditorProps) {
  const t = useT();
  const idBase = useId();
  const [newId] = useState(() => crypto.randomUUID());
  const { kit, primary, base, baseline, set, commit } = useStatusForm(p);
  const { form } = kit;
  const persist = useStatusPersist({
    editing: p.editing,
    baseline,
    commit,
    newId,
    nextSortOrder: p.nextSortOrder,
    onConflict: () => kit.setConflict(true),
    onChanged: p.onChanged,
    onDone: p.onDone,
    setFormError: (name, message) => {
      form.setError(name as never, { type: 'server', message });
      kit.noteTextError(name);
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => {
      if (!p.editing && !base.code.trim()) {
        toast.error(t('admin.orders.statuses.requiredFields'));
        return;
      }
      return persist.submit(base, values.texts);
    },
    (errors) => {
      for (const l of Object.keys(errors.texts ?? {}))
        kit.noteTextError(`texts.${l}.x`);
    },
  );
  const nameError = form.formState.errors.texts?.[kit.active]?.name;

  return (
    <>
      <form onSubmit={(e: FormEvent) => void onSubmit(e)} className="space-y-4">
        <LanguageTabs
          languages={p.languages}
          active={kit.active}
          onChange={kit.setActive}
          errorLocales={kit.errorLocales}
          statusOf={(c) => kit.statuses[c]?.status ?? 'missing'}
        />
        <div className="space-y-2" key={kit.active}>
          <Label htmlFor={`${idBase}-name`}>
            {kit.active === primary
              ? t('common.nameRequiredLabel')
              : t('common.name')}
          </Label>
          <Input
            id={`${idBase}-name`}
            {...form.register(`texts.${kit.active}.name`, {
              onChange: (e: { target: { value: string } }) => {
                if (!p.editing && kit.active === primary && !base.code)
                  set({ code: generateStatusCode(e.target.value) });
              },
            })}
            aria-invalid={!!nameError}
            placeholder={t('admin.orders.statuses.namePlaceholder')}
          />
          {nameError && (
            <p role="alert" className="text-xs text-destructive">
              {nameError.type === 'server'
                ? nameError.message
                : t('validation.fieldRequired')}
            </p>
          )}
        </div>
        <StatusBaseFields
          idBase={idBase}
          base={base}
          set={set}
          editing={p.editing && { isDefault: baseline.base.isDefault }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={p.onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={persist.isSubmitting}>
            {p.editing ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </form>
      <ConflictDialog
        open={kit.conflict}
        title={t('admin.orders.statuses.conflict.title')}
        description={t('admin.orders.statuses.conflict.description')}
        onReload={() => void kit.reload()}
        onKeep={() => kit.setConflict(false)}
      />
    </>
  );
}

/** Стор версії — над `Body`: `useAggregateCommand` читає його з контексту. */
export function StatusEditor(p: StatusEditorProps) {
  const store = useAggregateVersionStore(p.aggregate.version);
  return (
    <AggregateVersionContext.Provider value={store}>
      <Body {...p} />
    </AggregateVersionContext.Provider>
  );
}
