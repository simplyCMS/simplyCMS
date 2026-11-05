import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { DialogFooter } from 'simplycms/ui/dialog';
import { ConflictDialog } from '../translations/ConflictDialog';
import { LanguageTabs } from '../translations/LanguageTabs';
import type { LanguageInfo } from '../translations/translation-context';
import { textsToForm } from '../translations/texts-form';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../translations/useAggregateCommand';
import {
  useTranslatableTexts,
  type TextsAggregate,
} from '../translations/useTranslatableTexts';
import {
  EMPTY_STATUS_BASE,
  generateStatusCode,
  STATUS_FIELDS,
  STATUS_REQUIRED,
  type StatusBaseForm,
} from './form-data';
import { useStatusPersist } from './useStatusPersist';

export interface StatusEditorProps {
  readonly editing: { id: string; isDefault: boolean; code: string } | null;
  /** Завантажений агрегат (редагування) або порожній (створення). */
  readonly aggregate: TextsAggregate<'name'> & {
    readonly base?: { color: string | null };
  };
  readonly languages: readonly LanguageInfo[];
  readonly refetch: () => Promise<
    (TextsAggregate<'name'> & { base?: { color: string | null } }) | undefined
  >;
  readonly nextSortOrder: number;
  readonly onChanged: () => void;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

const baseOf = (
  editing: StatusEditorProps['editing'],
  color: string | null | undefined,
): StatusBaseForm => ({
  code: editing?.code ?? '',
  color: color || EMPTY_STATUS_BASE.color,
  isDefault: editing?.isDefault ?? false,
});

/** Форма статусу: вкладки мов (тексти), код, колір, дефолт. Версія агрегата — у контексті. */
function Body(p: StatusEditorProps) {
  const t = useT();
  const idBase = useId();
  const primary =
    p.languages.find((l) => l.isDefault)?.code ?? p.languages[0]!.code;
  const codes = p.languages.map((l) => l.code);
  const [newId] = useState(() => crypto.randomUUID());
  const [base, setBase] = useState(() =>
    baseOf(p.editing, p.aggregate.base?.color),
  );
  const [baseline, setBaseline] = useState(() => ({
    base: baseOf(p.editing, p.aggregate.base?.color),
    texts: textsToForm(STATUS_FIELDS, p.aggregate.texts, codes),
  }));
  const kit = useTranslatableTexts({
    fields: STATUS_FIELDS,
    primary,
    languages: p.languages,
    aggregate: p.aggregate,
    required: STATUS_REQUIRED,
    refetch: async () => {
      const fresh = await p.refetch();
      if (fresh) {
        const b = baseOf(p.editing, fresh.base?.color);
        setBase((prev) => ({ ...prev, color: b.color }));
        setBaseline({
          base: b,
          texts: textsToForm(STATUS_FIELDS, fresh.texts, codes),
        });
      }
      return fresh;
    },
  });
  const { form } = kit;
  const set = (patch: Partial<StatusBaseForm>) =>
    setBase((prev) => ({ ...prev, ...patch }));
  const persist = useStatusPersist({
    editing: p.editing,
    baseline,
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
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-code`}>
            {t('admin.orders.statuses.codeRequired')}
          </Label>
          <Input
            id={`${idBase}-code`}
            value={base.code}
            disabled={!!p.editing}
            onChange={(e) => set({ code: e.target.value })}
            placeholder="processing"
          />
          <p className="text-xs text-muted-foreground">
            {p.editing
              ? t('admin.orders.statuses.codeImmutable')
              : t('admin.orders.statuses.codeHint')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-color`}>{t('common.color')}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id={`${idBase}-color`}
              value={base.color}
              onChange={(e) => set({ color: e.target.value })}
              className="w-12 h-10 rounded border cursor-pointer"
            />
            <Input
              value={base.color}
              onChange={(e) => set({ color: e.target.value })}
              placeholder="#6B7280"
              className="flex-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={`${idBase}-default`}>{t('common.byDefault')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('admin.orders.statuses.autoAssign')}
            </p>
          </div>
          <Switch
            id={`${idBase}-default`}
            checked={base.isDefault}
            onCheckedChange={(checked) => set({ isDefault: checked })}
            // К3-15: зняти дефолт без призначення нового не можна — нуль дефолтів заборонений.
            disabled={!!p.editing?.isDefault}
          />
        </div>
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
