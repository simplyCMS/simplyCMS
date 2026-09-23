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
import { StockEditor } from '../stock/StockEditor';

interface Props {
  readonly productId: string;
  readonly modificationId: string;
  /** Розділ товару — секція властивостей (Task 10, поки проп без вжитку). */
  readonly sectionId: string | null;
}

/**
 * Ціни й залишки ІСНУЮЧОЇ модифікації — виніс із `ModificationDialog.tsx`
 * (канон 150 рядків). Властивості (Task 10) сюди додає наступна задача.
 */
export function ModificationDialogSections({
  productId,
  modificationId,
}: Props) {
  const t = useT();
  const [pricesOpen, setPricesOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);

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
    </>
  );
}
