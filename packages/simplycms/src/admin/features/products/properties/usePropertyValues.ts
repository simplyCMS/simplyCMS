import { useFormContext, useWatch } from 'react-hook-form';
import type { SectionProperty } from 'simplycms/schema/types';
import { useProductCard } from '../edit/product-card-context';
import type {
  DraftValue,
  ProductFormValues,
} from '../edit/product-form-schema';
import { useTranslationContext } from '../../translations/translation-context';
import {
  toDraftValue,
  toRow,
  type PropertyKind,
  type PropertyValueDraft,
} from './property-value-mapping';

export type { PropertyValueDraft };
export type PropertyValueTarget = 'product' | 'modification';

/**
 * Значення властивостей власника — товару або модифікації — як ЧЕРНЕТКА в
 * формі картки (`propertyValues`): мережі тут немає, на сервер вони йдуть
 * кнопкою «Зберегти» картки в одному `saveDescription`. Multiselect — рядок на
 * опцію. Текстові значення редагуються мовою активної вкладки. Серверна
 * помилка значення (`valueErrors`) показується біля поля, поки його не змінять.
 */
export function usePropertyValues(
  target: PropertyValueTarget,
  ownerId: string,
) {
  const { control, getValues, setValue } = useFormContext<ProductFormValues>();
  const all = useWatch({ control, name: 'propertyValues' });
  const { active } = useTranslationContext();
  const card = useProductCard();

  const owns = (v: DraftValue) =>
    target === 'product' ? !v.modificationId : v.modificationId === ownerId;
  const ofProperty = (list: readonly DraftValue[], propertyId: string) =>
    list.filter((v) => owns(v) && v.propertyId === propertyId);
  const write = (next: DraftValue[]) =>
    setValue('propertyValues', next, { shouldDirty: true });
  const owner = target === 'modification' ? { modificationId: ownerId } : {};

  const rowsOf = (propertyId: string) =>
    ofProperty(all, propertyId).map((v) => toRow(v, active));

  const saveScalar = (
    property: Pick<SectionProperty, 'id' | 'propertyType'>,
    v: PropertyValueDraft,
  ) => {
    card.clearValueError(property.id);
    const list = getValues('propertyValues');
    const existing = ofProperty(list, property.id)[0];
    const next = toDraftValue(
      {
        id: existing?.id ?? crypto.randomUUID(), // контракт id: ключ генерує клієнт
        propertyId: property.id,
        ...owner,
      },
      property.propertyType as PropertyKind,
      v,
      existing,
      active,
    );
    const rest = list.filter((x) => x !== existing);
    write(next ? [...rest, next] : rest);
  };

  const saveMulti = (
    property: Pick<SectionProperty, 'id'>,
    optionIds: readonly string[],
  ) => {
    card.clearValueError(property.id);
    const list = getValues('propertyValues');
    const mine = ofProperty(list, property.id);
    const keep = mine.filter(
      (x) => x.optionId && optionIds.includes(x.optionId),
    );
    const have = new Set(keep.map((x) => x.optionId));
    const added = optionIds
      .filter((id) => !have.has(id))
      .map((optionId): DraftValue => ({
        id: crypto.randomUUID(), // контракт id: ключ генерує клієнт
        propertyId: property.id,
        kind: 'multiselect',
        optionId,
        ...owner,
      }));
    write([...list.filter((x) => !mine.includes(x)), ...keep, ...added]);
  };

  return { rowsOf, saveScalar, saveMulti, errors: card.valueErrors };
}
