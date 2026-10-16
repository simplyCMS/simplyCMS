import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { createProduct, saveProductDescription } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { adminPath } from '../../../lib/adminLinks';
import { useAggregateCommand } from '../../translations/useAggregateCommand';
import { blankForm } from './product-aggregate';
import type { ProductFormValues } from './product-form-schema';
import {
  buildCreateInput,
  buildSaveInput,
  isEmptyInput,
  type SaveIndex,
} from './product-save-input';
import { reportSaveError, type ErrorSink } from './save-errors';

interface UpdateOptions {
  readonly productId: string;
  /** Стан, з яким порівнюється форма (останній `products.get`). */
  readonly baseline: ProductFormValues;
  readonly onConflict: (currentVersion: number) => void;
  /** Після успіху: перечитати агрегат і скинути форму до нього. */
  readonly onSaved: () => Promise<void>;
  readonly sink: ErrorSink;
}

/**
 * Збереження існуючого товару: ОДИН запит `saveDescription` із різницею між
 * baseline і формою (тексти лише змінених вкладок, модифікації, значення,
 * фото). Конфлікт версії обробляє `useAggregateCommand`; помилки валідації
 * лягають на поля й рядки картки, форма при них не скидається.
 */
export function useProductUpdate(o: UpdateOptions) {
  const t = useT();
  const { run } = useAggregateCommand(saveProductDescription, {
    onConflict: o.onConflict,
  });

  return async (values: ProductFormValues) => {
    const { input, index } = buildSaveInput(o.baseline, values);
    if (isEmptyInput(input)) {
      toast.info(t('admin.translations.nothingToSave'));
      return;
    }
    try {
      const out = await run({ id: o.productId, ...input });
      if (!out) return;
      toast.success(t('admin.products.updated'));
      await o.onSaved();
    } catch (e) {
      reportSaveError(e, t, index, o.sink);
    }
  };
}

/**
 * Створення: `products.create` (тексти, база, адреса основної мови), а якщо
 * до збереження завантажено фото — другий крок `saveDescription` на версію зі
 * створення (створення дітей агрегата не приймає). id генерує форма наперед:
 * фото привʼязуються до нього ще до збереження.
 */
export function useProductCreate(entityId: string, sink: ErrorSink) {
  const t = useT();
  const navigate = useNavigate();
  const products = useCollection(productsCollection);
  const empty: SaveIndex = {
    modifications: [],
    propertyValues: [],
    images: [],
  };

  return async (values: ProductFormValues) => {
    try {
      const created = await createProduct({
        data: buildCreateInput(entityId, values),
      });
      const { input } = buildSaveInput(blankForm([]), {
        ...blankForm([]),
        images: values.images,
      });
      if (input.images)
        await saveProductDescription({
          data: {
            id: entityId,
            expectedVersion: created.version,
            images: input.images,
          },
        });
      // Список товарів — колекція лише для читання: новий рядок тягнемо перечитуванням.
      await products.utils.refetch();
      toast.success(t('admin.products.created'));
      await navigate({
        to: adminPath('products/$productId'),
        params: { productId: entityId },
      });
    } catch (e) {
      reportSaveError(e, t, empty, sink);
    }
  };
}
