import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'simplycms/ui/collapsible';
import { PricesEditor } from '../prices/PricesEditor';
import { PropertyValuesPanel } from '../properties/PropertyValuesPanel';
import { StockEditor } from '../stock/StockEditor';

interface Props {
  readonly productId: string;
  readonly modificationId: string;
  /** Розділ товару — секція властивостей значень модифікації (Task 10). */
  readonly sectionId: string | null;
}

/**
 * Ціни, залишки й значення властивостей ІСНУЮЧОЇ модифікації — виніс із
 * `ModificationDialog.tsx` (канон 150 рядків). Властивості (Task 10) —
 * `target='modification', appliesTo='modification'`: рядки пишуться в
 * `modification_property_values` з `modificationId`, не `productId`.
 */
export function ModificationDialogSections({
  productId,
  modificationId,
  sectionId,
}: Props) {
  const t = useT();
  const [pricesOpen, setPricesOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

  return (
    <>
      <Collapsible open={pricesOpen} onOpenChange={setPricesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50"
          >
            <span className="font-medium">
              {t('admin.products.mods.prices')}
            </span>
            {pricesOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <PricesEditor productId={productId} modificationId={modificationId} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={stockOpen} onOpenChange={setStockOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50"
          >
            <span className="font-medium">
              {t('admin.products.mods.stock')}
            </span>
            {stockOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <StockEditor
            productId={productId}
            modificationId={modificationId}
            showCard={false}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={propsOpen} onOpenChange={setPropsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            className="flex w-full justify-between p-3 border rounded-lg hover:bg-muted/50"
          >
            <span className="font-medium">
              {t('admin.properties.values.titleModification')}
            </span>
            {propsOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <PropertyValuesPanel
            target="modification"
            ownerId={modificationId}
            sectionId={sectionId}
            appliesTo="modification"
            showCard={false}
          />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
