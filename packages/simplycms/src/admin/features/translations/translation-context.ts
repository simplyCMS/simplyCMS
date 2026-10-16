import { createContext, useContext } from 'react';

/** Статус поля чи рядка перекладу відносно джерела (формула `domain/translations`). */
export type TranslationStatus = 'current' | 'outdated' | 'missing';

export interface LanguageInfo {
  readonly code: string;
  readonly name: string;
  readonly isDefault: boolean;
}

/** Статуси мови з `products.get`: рядок і кожне поле. */
export interface LocaleStatuses {
  readonly status: TranslationStatus;
  readonly fieldStatus: Readonly<Record<string, TranslationStatus>>;
}

export interface TranslationContextValue {
  readonly languages: readonly LanguageInfo[];
  /** Код основної мови — джерела перекладів. */
  readonly primary: string;
  /** Мова, яку зараз редагує картка. */
  readonly active: string;
  readonly setActive: (code: string) => void;
  /** Статуси за мовою; мови без запису тут немає — це «немає перекладу». */
  readonly statuses: Readonly<Record<string, LocaleStatuses>>;
}

export const TranslationContext = createContext<TranslationContextValue | null>(
  null,
);

export function useTranslationContext(): TranslationContextValue {
  const ctx = useContext(TranslationContext);
  if (!ctx)
    throw new Error('[translations] no TranslationContext in the card tree');
  return ctx;
}

/**
 * Статус поля мови. Основна мова — джерело (завжди `current`); мова без
 * рядка перекладу — `missing`, бо `products.get` віддає лише наявні рядки.
 */
export function fieldStatusOf(
  ctx: Pick<TranslationContextValue, 'primary' | 'statuses'>,
  locale: string,
  field: string,
): TranslationStatus {
  if (locale === ctx.primary) return 'current';
  return ctx.statuses[locale]?.fieldStatus[field] ?? 'missing';
}
