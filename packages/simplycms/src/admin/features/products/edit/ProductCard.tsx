import type { ReactNode } from 'react';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { ConflictDialog } from '../../translations/ConflictDialog';
import {
  AggregateVersionContext,
  useAggregateVersionStore,
} from '../../translations/useAggregateCommand';
import { ModificationsPanel } from '../modifications/ModificationsPanel';
import { PropertyValuesPanel } from '../properties/PropertyValuesPanel';
import { SimpleProductPanel } from '../simple/SimpleProductPanel';
import { ProductForm } from './ProductForm';
import { editCardContext } from './edit-card-context';
import { localeStatuses } from './product-aggregate';
import {
  useProductCardState,
  type ProductCardInput,
} from './useProductCardState';

/** Розмітка картки: стан і перечитування — у `useProductCardState`. */
function Body(props: ProductCardInput): ReactNode {
  const t = useT();
  const { productId, languages } = props;
  const s = useProductCardState(props);
  const { form, state, rows, primary, active, setActive } = s;
  const saved = state.agg.base;

  return (
    <>
      <ProductForm
        form={form}
        mode="edit"
        translation={{
          languages,
          primary,
          statuses: localeStatuses(state.agg),
          active,
          setActive,
        }}
        errorLocales={rows.errorLocales}
        onInvalidLocales={(locales) => {
          rows.reset();
          for (const l of locales)
            rows.noteTextError(`texts.${l}.x`, setActive);
        }}
        card={editCardContext(productId, s)}
        onSubmit={(values) => {
          rows.reset();
          return s.save(values);
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
        open={s.conflict}
        onReload={() => s.reload()}
        onKeep={() => s.setConflict(false)}
      />
    </>
  );
}

/**
 * Картка існуючого товару. Стор версії — тут, над `Body`: хук
 * `useAggregateCommand` читає його з контексту, а не з пропсів.
 */
export function ProductCard(props: ProductCardInput) {
  const store = useAggregateVersionStore(props.aggregate.version);
  return (
    <AggregateVersionContext.Provider value={store}>
      <Body {...props} />
    </AggregateVersionContext.Provider>
  );
}
