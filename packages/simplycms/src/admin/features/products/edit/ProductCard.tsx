import { useContext, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { ConflictDialog } from '../../translations/ConflictDialog';
import type {
  LanguageInfo,
  TranslationStatus,
} from '../../translations/translation-context';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../../translations/useAggregateCommand';
import { ModificationsPanel } from '../modifications/ModificationsPanel';
import { PropertyValuesPanel } from '../properties/PropertyValuesPanel';
import { SimpleProductPanel } from '../simple/SimpleProductPanel';
import { ProductForm } from './ProductForm';
import {
  aggregateToForm,
  localeStatuses,
  rebase,
  type ProductAggregate,
} from './product-aggregate';
import {
  productFormSchemaFor,
  type ProductFormValues,
} from './product-form-schema';
import { useProductUpdate } from './useProductSave';
import { useRowErrors } from './useRowErrors';
import { useStockStatusSync } from './useStockStatusSync';

interface Props {
  readonly productId: string;
  readonly aggregate: ProductAggregate;
  readonly languages: readonly LanguageInfo[];
  readonly refetch: () => Promise<ProductAggregate | undefined>;
}

function Body({ productId, aggregate, languages, refetch }: Props): ReactNode {
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
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchemaFor(primary)),
    defaultValues: state.baseline,
  });

  const [active, setActive] = useState(primary);

  /**
   * Перечитування: знімок стає станом БД. Свідоме («Перезавантажити») скидає
   * форму цілком; після власного збереження (`sent`) поля, які користувач
   * змінив ПІСЛЯ відправки запиту, лишаються його (`rebase`).
   */
  const reload = async (sent?: ProductFormValues) => {
    const fresh = await refetch();
    if (!fresh) {
      toast.error(t('admin.translations.loadFailed'));
      return;
    }
    const baseline = aggregateToForm(fresh, codes);
    setState({ agg: fresh, baseline });
    form.reset(sent ? rebase(baseline, sent, form.getValues()) : baseline);
    store.set(fresh.version);
    rows.reset();
    setConflict(false);
    // Список товарів читає ту саму назву з колонки-дзеркала: перечитуємо його.
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

  const statuses = localeStatuses(state.agg);
  const saved = state.agg.base;

  return (
    <>
      <ProductForm
        form={form}
        mode="edit"
        translation={{ languages, primary, statuses, active, setActive }}
        errorLocales={rows.errorLocales}
        onInvalidLocales={(locales) => {
          rows.reset();
          for (const l of locales)
            rows.noteTextError(`texts.${l}.x`, setActive);
        }}
        card={{
          productId,
          entityId: productId,
          paths: state.agg.paths,
          persistedModificationIds: new Set(
            state.baseline.modifications.map((m) => m.id),
          ),
          modificationErrors: rows.modificationErrors,
          valueErrors: rows.valueErrors,
          clearValueError: rows.clearValueError,
          onConflict: () => setConflict(true),
          onStockStatus,
          onPathSaved: (locale, path) =>
            setState((s) => ({
              ...s,
              agg: { ...s.agg, paths: { ...s.agg.paths, [locale]: path } },
            })),
          statusOfModificationName: (id, l) =>
            state.agg.modifications.find((m) => m.id === id)?.texts[l]
              ?.status as TranslationStatus | undefined,
          statusOfValueText: (id, l) =>
            state.agg.propertyValues.find((v) => v.id === id)?.textStatus?.[
              l
            ] as TranslationStatus | undefined,
        }}
        onSubmit={(values) => {
          rows.reset();
          return save(values);
        }}
        submitLabel={t('common.save')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {saved.hasModifications ? (
              <ModificationsPanel
                productId={productId}
                sectionId={saved.sectionId}
              />
            ) : (
              <SimpleProductPanel productId={productId} />
            )}
            <PropertyValuesPanel
              target="product"
              ownerId={productId}
              sectionId={saved.sectionId}
              appliesTo={saved.hasModifications ? 'product' : 'all'}
            />
            <PluginSlot
              name="admin.product.form.after"
              context={{ productId }}
            />
          </div>
        </div>
      </ProductForm>
      <ConflictDialog
        open={conflict}
        onReload={() => reload()}
        onKeep={() => setConflict(false)}
      />
    </>
  );
}

/**
 * Картка існуючого товару. Стор версії — тут, над `Body`: хук
 * `useAggregateCommand` читає його з контексту, а не з пропсів.
 */
export function ProductCard(props: Props) {
  const store = useAggregateVersionStore(props.aggregate.version);
  return (
    <AggregateVersionContext.Provider value={store}>
      <Body {...props} />
    </AggregateVersionContext.Provider>
  );
}
