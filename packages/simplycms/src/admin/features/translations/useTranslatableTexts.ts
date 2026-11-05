import { useContext, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useT } from 'simplycms/i18n';
import { useTextErrors } from './texts-errors';
import { localeStatusesOf, textsToForm, type TextsForm } from './texts-form';
import { rebaseTexts } from './texts-rebase';
import type { LanguageInfo, LocaleStatuses } from './translation-context';
import { AggregateVersionContext } from './useAggregateCommand';

/** Агрегат, з якого хук бере тексти: версія кореня й рядки за мовами зі статусами. */
export interface TextsAggregate<F extends string> {
  readonly version: number;
  readonly texts: Readonly<
    Record<
      string,
      Readonly<Partial<Record<F, string | null>>> & {
        readonly status: string;
        readonly fieldStatus: Readonly<Record<string, string>>;
      }
    >
  >;
}

export interface TranslatableTextsOptions<F extends string> {
  readonly fields: readonly F[];
  readonly primary: string;
  readonly languages: readonly LanguageInfo[];
  readonly aggregate: TextsAggregate<F> | undefined;
  readonly refetch: () => Promise<unknown>;
}

const isAggregate = (x: unknown): x is TextsAggregate<string> =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as { version?: unknown }).version === 'number' &&
  typeof (x as { texts?: unknown }).texts === 'object';

export interface TranslatableTexts<F extends string> {
  readonly form: UseFormReturn<{ texts: TextsForm<F> }>;
  readonly active: string;
  readonly setActive: (code: string) => void;
  readonly statuses: Record<string, LocaleStatuses>;
  readonly conflict: boolean;
  readonly setConflict: (v: boolean) => void;
  /**
   * Перечитати агрегат. Без `sent` — свідоме («Перезавантажити»): форма і версія
   * беруть БД. Із `sent` (після власного збереження) введене ПІСЛЯ відправки
   * лишається значенням користувача й зміною (форма dirty), а версія — та, що дала
   * відповідь команди: чужий запис між ними дасть 412 при наступному збереженні.
   */
  readonly reload: (sent?: TextsForm<F>) => Promise<void>;
  readonly errorLocales: ReadonlySet<string>;
  /** Позначити помилку поля `texts.<мова>.<поле>` (вкладка + перемикання). */
  readonly noteTextError: (name: string) => void;
}

/**
 * Стан перекладної текстової частини картки (сторінка чи діалог): форма текстів,
 * активна вкладка, статуси, конфлікт версії, перечитування. Працює всередині
 * `AggregateVersionContext.Provider` — версію агрегата тримає він.
 */
export function useTranslatableTexts<F extends string>({
  fields,
  primary,
  languages,
  aggregate,
  refetch,
}: TranslatableTextsOptions<F>): TranslatableTexts<F> {
  const t = useT();
  const store = useContext(AggregateVersionContext);
  if (!store)
    throw new Error(
      '[translations] no AggregateVersionContext in the card tree',
    );
  const codes = languages.map((l) => l.code);
  const latest = useRef(aggregate);
  latest.current = aggregate;
  const [active, setActive] = useState(primary);
  const [conflict, setConflict] = useState(false);
  const errors = useTextErrors();
  const toForm = (a: TextsAggregate<F> | undefined) =>
    textsToForm(fields, a?.texts ?? {}, codes);
  const form = useForm<{ texts: TextsForm<F> }>({
    resolver: zodResolver(textsSchema(fields, primary)) as never,
    defaultValues: { texts: toForm(aggregate) },
  });

  const reload = async (sent?: TextsForm<F>) => {
    const out = await refetch();
    const fresh = isAggregate(out)
      ? (out as unknown as TextsAggregate<F>)
      : latest.current;
    if (!fresh) {
      toast.error(t('admin.translations.loadFailed'));
      return;
    }
    const baseline = toForm(fresh);
    const now = form.getValues('texts');
    form.reset({ texts: baseline });
    if (sent) {
      const next = rebaseTexts(fields, baseline, sent, now);
      for (const [l, row] of Object.entries(next))
        for (const f of fields)
          if (row[f] !== baseline[l]?.[f])
            form.setValue(`texts.${l}.${f}` as never, row[f] as never, {
              shouldDirty: true,
            });
    } else store.set(fresh.version);
    errors.reset();
    setConflict(false);
  };

  return {
    form,
    active,
    setActive,
    statuses: localeStatusesOf(aggregate?.texts ?? {}),
    conflict,
    setConflict,
    reload,
    errorLocales: errors.errorLocales,
    noteTextError: (name) => errors.noteTextError(name, setActive),
  };
}

/** Назва (перше поле) основної мови обовʼязкова, як і на картці товару (І4). */
function textsSchema(fields: readonly string[], primary: string) {
  const row = z.object(Object.fromEntries(fields.map((f) => [f, z.string()])));
  return z
    .object({ texts: z.record(z.string(), row) })
    .superRefine((v, ctx) => {
      const key = fields[0]!;
      if (!(v.texts[primary]?.[key] ?? '').trim())
        ctx.addIssue({
          code: 'custom',
          path: ['texts', primary, key],
          message: key,
        });
    });
}
