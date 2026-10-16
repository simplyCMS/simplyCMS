import { useFormContext, useWatch } from 'react-hook-form';
import type { DraftModification } from '../edit/product-form-schema';
import type { ProductFormValues } from '../edit/product-form-schema';
import { withScopedImages } from '../edit/product-images';
import type { ModificationFormValues } from './modification-form-schema';
import { toDraftModification } from './modification-form-values';

/**
 * Модифікації товару — ЧЕРНЕТКА в формі картки (`modifications` у значеннях).
 * Жодної мережі: усе піде одним `saveDescription` кнопкою «Зберегти» картки.
 * Дефолт і порядок — звичайні поля чернетки (`isDefault`, `sortOrder`), а
 * єдиність дефолта тримає сервер (знімає прапор з решти в тій самій транзакції).
 */
export function useModifications() {
  const { control, getValues, setValue } = useFormContext<ProductFormValues>();
  const all = useWatch({ control, name: 'modifications' });
  const modifications = [...all].sort((a, b) => a.sortOrder - b.sortOrder);

  const write = (next: DraftModification[]) =>
    setValue('modifications', next, { shouldDirty: true });

  /** Порядок 0..n-1 за поточним розташуванням. */
  const renumber = (list: DraftModification[]) =>
    list.map((m, i) => ({ ...m, sortOrder: i }));

  const setDefault = (id: string) =>
    write(
      getValues('modifications').map((m) => ({
        ...m,
        isDefault: m.id === id,
      })),
    );

  /** Нова або змінена модифікація разом із її фото. */
  const save = (id: string, form: ModificationFormValues) => {
    const list = getValues('modifications');
    const existing = list.find((m) => m.id === id);
    const sortOrder =
      existing?.sortOrder ?? Math.max(-1, ...list.map((m) => m.sortOrder)) + 1;
    const draft = toDraftModification(id, form, sortOrder);
    const next = existing
      ? list.map((m) => (m.id === id ? draft : m))
      : [...list, draft];
    write(
      form.isDefault
        ? next.map((m) => ({ ...m, isDefault: m.id === id }))
        : next,
    );
    setValue('images', withScopedImages(getValues('images'), id, form.images), {
      shouldDirty: true,
    });
  };

  const remove = (id: string) => {
    write(renumber(getValues('modifications').filter((m) => m.id !== id)));
    // Фото й значення прибраної модифікації зникають каскадом на сервері.
    setValue(
      'images',
      getValues('images').filter((i) => i.modificationId !== id),
      { shouldDirty: true },
    );
    setValue(
      'propertyValues',
      getValues('propertyValues').filter((v) => v.modificationId !== id),
      { shouldDirty: true },
    );
  };

  const reorder = (id: string, direction: 'up' | 'down') => {
    const list = [...getValues('modifications')].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const i = list.findIndex((m) => m.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    write(renumber(list));
  };

  return { modifications, save, remove, setDefault, reorder };
}
