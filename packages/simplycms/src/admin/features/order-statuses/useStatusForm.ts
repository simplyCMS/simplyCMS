import { useState } from 'react';
import type { LanguageInfo } from '../translations/translation-context';
import { textsToForm, type TextsForm } from '../translations/texts-form';
import {
  useTranslatableTexts,
  type TextsAggregate,
} from '../translations/useTranslatableTexts';
import {
  EMPTY_STATUS_BASE,
  STATUS_FIELDS,
  STATUS_REQUIRED,
  type StatusBaseForm,
} from './form-data';

/** Агрегат статусу для форми: тексти, колір і (з рядка списку) ознака дефолту. */
export type StatusAggregate = TextsAggregate<'name'> & {
  readonly base?: { color: string | null };
  readonly isDefault?: boolean;
};

export interface StatusEditing {
  readonly id: string;
  readonly isDefault: boolean;
  readonly code: string;
}

const baseOf = (
  editing: StatusEditing | null,
  agg: StatusAggregate,
): StatusBaseForm => ({
  code: editing?.code ?? '',
  color: agg.base?.color || EMPTY_STATUS_BASE.color,
  isDefault: agg.isDefault ?? editing?.isDefault ?? false,
});

/**
 * Стан форми статусу: набір текстів (`useTranslatableTexts`), неперекладна основа (код, колір,
 * дефолт), їхній baseline для різниці. Після перезавантаження конфлікту ВСЯ основа береться зі
 * свіжого агрегата; після власного збереження baseline зсувається на надіслане (`commit`), щоб
 * повторне «Зберегти» (напр. після збою `setDefault`) не слало той самий патч удруге.
 */
export function useStatusForm(o: {
  editing: StatusEditing | null;
  aggregate: StatusAggregate;
  languages: readonly LanguageInfo[];
  refetch: () => Promise<StatusAggregate | undefined>;
}) {
  const codes = o.languages.map((l) => l.code);
  const primary =
    o.languages.find((l) => l.isDefault)?.code ?? o.languages[0]!.code;
  const [base, setBase] = useState(() => baseOf(o.editing, o.aggregate));
  const [baseline, setBaseline] = useState(() => ({
    base: baseOf(o.editing, o.aggregate),
    texts: textsToForm(STATUS_FIELDS, o.aggregate.texts, codes),
  }));
  const kit = useTranslatableTexts({
    fields: STATUS_FIELDS,
    primary,
    languages: o.languages,
    aggregate: o.aggregate,
    required: STATUS_REQUIRED,
    refetch: async () => {
      const fresh = await o.refetch();
      if (fresh) {
        const b = baseOf(o.editing, fresh);
        setBase((prev) => ({
          ...prev,
          color: b.color,
          isDefault: b.isDefault,
        }));
        setBaseline({
          base: b,
          texts: textsToForm(STATUS_FIELDS, fresh.texts, codes),
        });
      }
      return fresh;
    },
  });
  return {
    kit,
    primary,
    base,
    baseline,
    set: (patch: Partial<StatusBaseForm>) =>
      setBase((prev) => ({ ...prev, ...patch })),
    /** Надіслане збережено: наступна різниця рахується від нього. */
    commit: (sentBase: StatusBaseForm, sentTexts: TextsForm<'name'>) =>
      setBaseline((prev) => ({
        base: { ...prev.base, color: sentBase.color },
        texts: sentTexts,
      })),
  };
}
