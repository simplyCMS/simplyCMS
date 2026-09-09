import { Filter } from 'lucide-react';
import type { CatalogSlots } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Sheet, SheetContent, SheetTrigger } from 'simplycms/ui/sheet';

/**
 * Панель інструментів вибірки: мобільна шторка з фільтрами, лічильник
 * товарів, сортування й перемикач вигляду. Спільна для каталогу й розділу.
 */
export function CatalogToolbar({
  productCount,
  slots,
}: {
  productCount: number;
  slots: CatalogSlots;
}) {
  const t = useT();

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6 pb-4 border-b">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <Filter className="h-4 w-4 mr-2" />
              {t('catalog.filters')}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            {/* Той самий реквізит фільтрів — у мобільній шторці */}
            <slots.Filters />
          </SheetContent>
        </Sheet>

        <span className="truncate text-sm text-muted-foreground">
          {t('catalog.productsCount', { count: productCount })}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Реквізити: сортування і перемикач вигляду */}
        <slots.SortSelect />
        <slots.ViewModeToggle />
      </div>
    </div>
  );
}
