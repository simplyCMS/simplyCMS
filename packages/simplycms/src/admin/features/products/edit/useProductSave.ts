import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { createProduct, saveProductDescription } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { adminPath } from '../../../lib/adminLinks';
import { useAggregateCommand } from '../../translations/useAggregateCommand';
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
  readonly onSaved: (sent: ProductFormValues) => Promise<void>;
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
      await o.onSaved(values);
    } catch (e) {
      reportSaveError(e, t, index, o.sink);
    }
  };
}

/**
 * Створення — ОДНА команда `products.create` (тексти, база, адреса основної мови, фото): збій
 * не лишає товару без фото, тож повтор «Створити» з тим самим id не впирається в дубль ключа.
 * id генерує форма наперед: фото привʼязуються до нього ще до збереження.
 */
export function useProductCreate(
  entityId: string,
  sink: ErrorSink,
  primary: string,
) {
  const t = useT();
  const navigate = useNavigate();
  const products = useCollection(productsCollection);
  return async (values: ProductFormValues) => {
    // Помилка `images.upsert.<i>` лягає на рядок фото картки.
    const index: SaveIndex = {
      modifications: [],
      propertyValues: [],
      images: values.images.map((i) => i.id),
    };
    let created;
    try {
      created = await createProduct({
        data: buildCreateInput(entityId, values),
      });
    } catch (e) {
      reportSaveError(e, t, index, sink);
      return;
    }
    // Явна адреса, яку генератор змінив (зайнята → `-2`), не лишається тихою.
    const actual = created.paths[primary];
    if (values.path !== '' && actual && actual !== values.path)
      toast.info(t('admin.translations.path.adjusted', { path: actual }));
    // Товар уже створено: збій перечитування списку (колекція лише для читання) не має
    // лишати форму «Новий товар» з тим самим id — повтор дав би дубль ключа. Список
    // дотягнеться при наступному відкритті.
    await products.utils.refetch().catch(() => undefined);
    toast.success(t('admin.products.created'));
    await navigate({
      to: adminPath('products/$productId'),
      params: { productId: entityId },
    });
  };
}
