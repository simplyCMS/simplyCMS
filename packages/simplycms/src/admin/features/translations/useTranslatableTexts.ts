import { useContext, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useT, type MessageKey } from 'simplycms/i18n';
import { useTextErrors } from './texts-errors';
import { localeStatusesOf, textsToForm, type TextsForm } from './texts-form';
import { textsEdits } from './texts-rebase';
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
  /**
   * Агрегат, ВЖЕ завантажений: форма наповнюється ним лише при монтуванні, тож
   * споживач рендерить картку/діалог після появи даних запиту (як картка товару).
   */
  readonly aggregate: TextsAggregate<F>;
  /** Поля, обовʼязкові в основній мові (реєстр сутності); порожній — без вимог. */
  readonly required: readonly F[];
  /** Перечитати агрегат; `undefined` — не вдалося (хук покаже тост і лишить форму). */
  readonly refetch: () => Promise<TextsAggregate<F> | undefined>;
  /**
   * Ключ тосту, коли перечитати не вдалося: текст називає сутність споживача
   * («статус», «товар»), тож спільний хук не тримає жорсткого.
   */
  readonly loadFailedKey: MessageKey;
}

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
  required,
  refetch,
  loadFailedKey,
}: TranslatableTextsOptions<F>): TranslatableTexts<F> {
  const t = useT();
  const store = useContext(AggregateVersionContext);
  if (!store)
    throw new Error(
      '[translations] no AggregateVersionContext in the card tree',
    );
  const codes = languages.map((l) => l.code);
  const [agg, setAgg] = useState(aggregate);
  const [active, setActive] = useState(primary);
  const [conflict, setConflict] = useState(false);
  const errors = useTextErrors();
  const toForm = (a: TextsAggregate<F>) => textsToForm(fields, a.texts, codes);
  const form = useForm<{ texts: TextsForm<F> }>({
    resolver: zodResolver(textsSchema(fields, required, primary)) as never,
    defaultValues: { texts: toForm(aggregate) },
  });

  const reload = async (sent?: TextsForm<F>) => {
    const fresh = await refetch();
    if (!fresh) {
      toast.error(t(loadFailedKey));
      return;
    }
    const baseline = toForm(fresh);
    const now = form.getValues('texts');
    setAgg(fresh);
    form.reset({ texts: baseline });
    if (sent)
      for (const e of textsEdits(fields, baseline, sent, now))
        form.setValue(
          `texts.${e.locale}.${e.field}` as never,
          e.value as never,
          {
            shouldDirty: true,
          },
        );
    else store.set(fresh.version);
    errors.reset();
    setConflict(false);
  };

  return {
    form,
    active,
    setActive,
    statuses: localeStatusesOf(agg.texts),
    conflict,
    setConflict,
    reload,
    errorLocales: errors.errorLocales,
    noteTextError: (name) => errors.noteTextError(name, setActive),
  };
}

/** Обовʼязкові поля основної мови (реєстр сутності); повідомлення — ключ i18n. */
function textsSchema(
  fields: readonly string[],
  required: readonly string[],
  primary: string,
) {
  const row = z.object(Object.fromEntries(fields.map((f) => [f, z.string()])));
  return z
    .object({ texts: z.record(z.string(), row) })
    .superRefine((v, ctx) => {
      for (const key of required)
        if (!(v.texts[primary]?.[key] ?? '').trim())
          ctx.addIssue({
            code: 'custom',
            path: ['texts', primary, key],
            message: 'validation.fieldRequired',
          });
    });
}
