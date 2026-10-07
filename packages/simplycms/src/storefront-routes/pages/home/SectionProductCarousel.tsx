import { useDiscountEnvironment } from 'simplycms/core/hooks/useDiscountEnvironment';
import { ProductCarousel } from '../../components/ProductCarousel';
import { useSectionProducts } from './queries';
import { toCardViewModel } from './toCardViewModel';
import type { HomeProduct, HomeSection } from './types';

export interface SectionProductCarouselProps {
  section: HomeSection;
  /** Товари секції з SSR-лоадера — без них карусель зробила б власний запит */
  initialData?: HomeProduct[];
}

/**
 * Канонічна секція головної: товарна добірка однієї кореневої категорії.
 * Порожні категорії не рендеряться.
 */
export function SectionProductCarousel({
  section,
  initialData,
}: SectionProductCarouselProps) {
  const { data: products } = useSectionProducts(section, { initialData });
  const { data: env } = useDiscountEnvironment();

  if (!products?.length) return null;

  return (
    <ProductCarousel
      title={section.name}
      products={toCardViewModel(products, env)}
      viewAllLink={`/catalog/${section.slug}`}
    />
  );
}
