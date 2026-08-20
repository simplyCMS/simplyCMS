import type {
  ProductDetailCharacteristics,
  ProductDetailDescription,
  ProductDetailSlots,
} from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { ProductCharacteristics } from '@simplycms/core/components/catalog/ProductCharacteristics';
import { ViewPanel, ViewPanelHeading } from '../parts/ViewPanel';

/**
 * Нижня частина картки товару — чотири білі панелі на сірому полотні.
 *
 * 🔴 Липкої панелі табів тут немає навмисно: у референсі табів немає взагалі,
 * контент розкладено картками (спека §1). Це та структурна розбіжність, яку
 * контракт v3 і дозволяє закрити темі — канонічна сторінка ядра лишається
 * недоторканою.
 *
 * Наявність і відгуки — реквізити ядра з власними запитами: тема віддає їм
 * місце в панелі, але не вміст.
 */
export function ProductPanels({
  description,
  characteristics,
  slots,
}: {
  description: ProductDetailDescription;
  characteristics: ProductDetailCharacteristics;
  slots: ProductDetailSlots;
}) {
  const t = useT();
  const hasCharacteristics = characteristics.items.length > 0;

  return (
    <>
      <ViewPanel className="mt-4">
        <ViewPanelHeading>{t('product.description')}</ViewPanelHeading>
        {description.html ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: description.html }}
          />
        ) : (
          <p className="text-muted-foreground">{t('product.noDescription')}</p>
        )}
      </ViewPanel>

      {hasCharacteristics && (
        <ViewPanel className="mt-4">
          <ViewPanelHeading>{t('product.characteristics')}</ViewPanelHeading>
          <ProductCharacteristics propertyValues={characteristics.items} />
        </ViewPanel>
      )}

      <ViewPanel className="mt-4">
        <ViewPanelHeading>{t('product.availabilityInStores')}</ViewPanelHeading>
        {/* Реквізит: наявність по точках видачі */}
        <slots.StockAvailability />
      </ViewPanel>

      <ViewPanel className="mt-4">
        <ViewPanelHeading>{t('product.reviews')}</ViewPanelHeading>
        {/* Реквізит: відгуки */}
        <slots.Reviews />
      </ViewPanel>
    </>
  );
}
