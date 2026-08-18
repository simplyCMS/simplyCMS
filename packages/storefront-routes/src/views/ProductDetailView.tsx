import type { ProductDetailViewModel } from '@simplycms/objects/views';
import { ProductGallery } from '@simplycms/core/components/catalog/ProductGallery';
import { StorefrontBreadcrumbs } from './StorefrontBreadcrumbs';
import { ProductDetailInfo } from './ProductDetailInfo';
import { ProductDetailSections } from './ProductDetailSections';

/**
 * Канонічний view картки товару (контракт тем v3).
 *
 * 🔴 Чиста функція від view-model: жодних запитів, жодного доступу до БД.
 * Дозволені лише render-контекстні хуки (`useT` у підкомпонентах) і власний
 * UI-стан компонентів ядра (активне фото галереї). Тема може підмінити цей
 * view своїм — контейнер віддає той самий vm.
 */
export function ProductDetailView({
  breadcrumbs,
  gallery,
  summary,
  description,
  characteristics,
  slots,
}: ProductDetailViewModel) {
  return (
    <div className="container mx-auto px-4 py-8">
      <StorefrontBreadcrumbs items={breadcrumbs} />

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <ProductGallery images={gallery.images} productName={summary.name} />
        </div>

        {/* Product info */}
        <ProductDetailInfo summary={summary} slots={slots} />
      </div>

      <ProductDetailSections
        description={description}
        characteristics={characteristics}
        slots={slots}
      />

      {/* Реквізит: точка розширення плагінів після вмісту сторінки */}
      <slots.PluginAfter />
    </div>
  );
}
