import type { DraftValue } from '../edit/product-form-schema';

/** Значення контролу властивості (формат полів вводу — рядки). */
export interface PropertyValueDraft {
  readonly value: string | null;
  readonly numericValue: string | null;
  readonly optionId: string | null;
}

/** Рядок для контролу: те, що показує `PropertyInput`. */
export interface ValueRow extends PropertyValueDraft {
  readonly id: string;
  readonly propertyId: string;
}

export type PropertyKind = DraftValue['kind'];

/** Значення агрегата → рядок для контролу; текст — мовою активної вкладки. */
export function toRow(v: DraftValue, locale: string): ValueRow {
  const scalar =
    v.kind === 'text'
      ? (v.text?.[locale] ?? null)
      : v.kind === 'boolean'
        ? v.bool === undefined
          ? null
          : String(v.bool)
        : v.kind === 'color'
          ? (v.color ?? null)
          : null;
  return {
    id: v.id,
    propertyId: v.propertyId,
    value: scalar,
    numericValue: v.number ?? null,
    optionId: v.optionId ?? null,
  };
}

const blank = (s: string | null) => s === null || s === '';

/**
 * Значення контролу → значення агрегата за типом властивості; `null` —
 * «порожньо», рядок має зникнути. Для `text` зберігаються тексти решти мов:
 * контрол редагує лише активну.
 */
export function toDraftValue(
  base: Pick<DraftValue, 'id' | 'propertyId' | 'modificationId'>,
  kind: PropertyKind,
  v: PropertyValueDraft,
  existing: DraftValue | undefined,
  locale: string,
): DraftValue | null {
  const head = { ...base, kind };
  switch (kind) {
    case 'text': {
      const text = {
        ...existing?.text,
        [locale]: blank(v.value) ? null : v.value,
      };
      return Object.values(text).every((x) => x === null)
        ? null
        : { ...head, text };
    }
    case 'number':
    case 'range':
      return blank(v.numericValue)
        ? null
        : { ...head, number: v.numericValue! };
    case 'select':
      return v.optionId ? { ...head, optionId: v.optionId } : null;
    case 'boolean':
      return v.value === null ? null : { ...head, bool: v.value === 'true' };
    case 'color':
      return blank(v.value) ? null : { ...head, color: v.value! };
    default:
      return null;
  }
}
