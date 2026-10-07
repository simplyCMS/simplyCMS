import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { OrderModificationPicker } from '../../orders/detail/OrderModificationPicker';
import {
  ProductSearchList,
  type ProductHit,
} from '../../orders/detail/ProductSearchList';

export interface PickedProduct {
  hit: ProductHit;
  modificationId: string | null;
}

interface Props {
  readonly value: PickedProduct | null;
  readonly onChange: (value: PickedProduct | null) => void;
}

/**
 * Товар і (за потреби) модифікація: ті самі компоненти, що в діалозі
 * додавання позиції замовлення, — пошук товару й зріз колекції модифікацій.
 */
export function ProductPicker({ value, onChange }: Props) {
  const t = useT();
  if (!value)
    return (
      <ProductSearchList
        onSelect={(hit) => onChange({ hit, modificationId: null })}
      />
    );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{value.hit.name}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(null)}
        >
          {t('admin.validator.productChange')}
        </Button>
      </div>
      {value.hit.hasModifications && (
        <OrderModificationPicker
          productId={value.hit.productId}
          productName={value.hit.name}
          value={value.modificationId}
          onChange={(modificationId) => onChange({ ...value, modificationId })}
        />
      )}
    </div>
  );
}
