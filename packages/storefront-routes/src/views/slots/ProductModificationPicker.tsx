import type { ComponentProps } from 'react';
import { PRODUCT_DETAIL_REQUISITES } from '@simplycms/objects/views';
import { useFormatPrice } from '@simplycms/react-query';
import { ModificationSelector } from '@simplycms/core/components/catalog/ModificationSelector';

type SelectorProps = ComponentProps<typeof ModificationSelector>;

export interface ProductModificationPickerProps extends Omit<
  SelectorProps,
  'formatPrice'
> {
  className?: string;
}

/**
 * Реквізит «вибір модифікації». Форматування ціни прибіндженe (конфіг
 * магазину), решта — стан вибору, який тримає container і синхронізує з URL.
 *
 * 🔴 Умова `<= 1` дублює власне правило `ModificationSelector` (він для
 * одної модифікації рендерить `null`) свідомо: без неї обгортка лишила б у
 * `space-y-*` порожній блок і зсунула б розкладку на 24px.
 */
export function ProductModificationPicker({
  className,
  modifications,
  ...rest
}: ProductModificationPickerProps) {
  const formatPrice = useFormatPrice();

  if (modifications.length <= 1) return null;

  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.ModificationSelector}
      className={className}
    >
      <ModificationSelector
        modifications={modifications}
        formatPrice={formatPrice}
        {...rest}
      />
    </div>
  );
}
