import { ProductCarousel } from '../../components/ProductCarousel';
import { useSectionProducts } from './queries';
import type { HomeSection } from './types';

/**
 * Канонічна секція головної: товарна добірка однієї кореневої категорії.
 * Порожні категорії не рендеряться.
 */
export function SectionProductCarousel({ section }: { section: HomeSection }) {
  const { data: products } = useSectionProducts(section);

  if (!products?.length) return null;

  return (
    <ProductCarousel
      title={section.name}
      products={products}
      viewAllLink={`/catalog/${section.slug}`}
    />
  );
}
