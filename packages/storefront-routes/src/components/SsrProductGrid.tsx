import { ProductCard } from '@simplycms/catalog-ui/ProductCard';
import type { ProductListItem } from '../server/product-list-item';

interface SsrProductGridProps {
  items: ProductListItem[];
  viewMode: 'grid' | 'list';
}

/**
 * Сітка товарів із серверних даних. Рендериться на сервері й у першому
 * клієнтському рендері — доки React Query не збагатить список (наявність,
 * знижки, рейтинги). Після цього сторінка перемикається на клієнтський список.
 */
export function SsrProductGrid({ items, viewMode }: SsrProductGridProps) {
  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'flex flex-col gap-4'
      }
    >
      {items.map((item) => (
        <ProductCard
          key={item.id}
          product={{
            id: item.id,
            name: item.name,
            slug: item.slug,
            images: item.imageUrl ? [item.imageUrl] : [],
            section: item.sectionSlug ? { slug: item.sectionSlug } : null,
            price: item.price,
          }}
        />
      ))}
    </div>
  );
}
