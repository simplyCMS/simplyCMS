import { useContext, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import type { LanguageInfo } from '../../translations/translation-context';
import { AggregateVersionContext } from '../../translations/useAggregateCommand';
import { aggregateToForm, type ProductAggregate } from './product-aggregate';
import {
  productFormSchemaFor,
  type ProductFormValues,
} from './product-form-schema';
import { resetAfterSave } from './product-rebase';
import { useProductUpdate } from './useProductSave';
import { useRowErrors } from './useRowErrors';
import { useStockStatusSync } from './useStockStatusSync';

export interface ProductCardInput {
  readonly productId: string;
  readonly aggregate: ProductAggregate;
  readonly languages: readonly LanguageInfo[];
  readonly refetch: () => Promise<ProductAggregate | undefined>;
}

/**
 * Стан картки існуючого товару: знімок БД (`agg` + `baseline` форми), форма,
 * помилки рядків, конфлікт версії й перечитування. Окремо від розмітки картки,
 * щоб `ProductCard` лишився композицією панелей (рев'ю Task 13).
 */
export function useProductCardState({
  productId,
  aggregate,
  languages,
  refetch,
}: ProductCardInput) {
  const t = useT();
  const codes = languages.map((l) => l.code);
  const primary = languages.find((l) => l.isDefault)?.code ?? codes[0]!;
  const [state, setState] = useState(() => ({
    agg: aggregate,
    baseline: aggregateToForm(aggregate, codes),
  }));
  const store = useContext(AggregateVersionContext)!;
  const rows = useRowErrors();
  const products = useCollection(productsCollection);
  const [conflict, setConflict] = useState(false);
  const [active, setActive] = useState(primary);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchemaFor(primary)),
    defaultValues: state.baseline,
  });

  /**
   * Перечитування: знімок стає станом БД. Свідоме («Перезавантажити») скидає
   * форму цілком; після власного збереження (`sent`) поля, які користувач
   * змінив ПІСЛЯ відправки запиту, лишаються його й лишаються змінами (`resetAfterSave`).
   */
  const reload = async (sent?: ProductFormValues) => {
    const fresh = await refetch();
    if (!fresh) {
      toast.error(t('admin.translations.loadFailed'));
      return;
    }
    const baseline = aggregateToForm(fresh, codes);
    setState({ agg: fresh, baseline });
    if (sent) resetAfterSave(form, baseline, sent);
    else form.reset(baseline);
    store.set(fresh.version);
    rows.reset();
    setConflict(false);
    // Список товарів читає ту саму назву з перекладу основної мови (read-model колекції): перечитуємо його.
    await products.utils.refetch();
  };

  const save = useProductUpdate({
    productId,
    baseline: state.baseline,
    onConflict: () => setConflict(true),
    onSaved: (sent) => reload(sent),
    sink: {
      setFormError: (name, message) => {
        form.setError(name as never, { type: 'server', message });
        rows.noteTextError(name, setActive);
      },
      setModificationError: rows.setModificationError,
      setValueError: rows.setValueError,
    },
  });

  const onStockStatus = useStockStatusSync(form, state.baseline, setState);

  return {
    form,
    state,
    setState,
    primary,
    active,
    setActive,
    rows,
    conflict,
    setConflict,
    reload,
    save,
    onStockStatus,
  };
}

export type ProductCardState = ReturnType<typeof useProductCardState>;
