import type { Banner } from '@simplycms/objects/objects';
import { useT } from '@simplycms/i18n';
import { BannerSlider } from '../components/BannerSlider';
import { ProductCarousel } from '../components/ProductCarousel';
import { useActiveThemeModule } from '../shells/useActiveThemeModule';
import {
  useFeaturedProducts,
  useNewProducts,
  useRootSections,
} from './home/queries';
import { SectionProductCarousel } from './home/SectionProductCarousel';
import type { HomeProduct, HomeSection } from './home/types';

export interface HomePageProps {
  banners?: Banner[];
  featuredProducts?: HomeProduct[];
  newProducts?: HomeProduct[];
  sections?: HomeSection[];
  /** Товари кореневих секцій із SSR-лоадера: `sectionId → товари` */
  sectionProducts?: Record<string, HomeProduct[]>;
}

/**
 * Канонічна головна сторінка ядра.
 *
 * Склад body зафіксовано контрактом (spec §6, D3/D4), щоб секції не
 * дублювалися між ядром і темами:
 *   1) hero — `theme.components.HeroBanner`, а якщо тема його не дала, ядро
 *      рендерить власний `BannerSlider`;
 *   2) канонічні секції — товарні добірки (популярні, новинки) і категорії:
 *      вони однакові для всіх тем, тому живуть у ядрі;
 *   3) `theme.components.HomeSections` — унікальні секції теми (бренди,
 *      розсилка, блог тощо), ПІСЛЯ канонічних і без пропсів.
 */
export default function HomePage({
  banners,
  featuredProducts: initialFeatured,
  newProducts: initialNew,
  sections: initialSections,
  sectionProducts,
}: HomePageProps) {
  const t = useT();
  const theme = useActiveThemeModule();
  const Hero = theme.components.HeroBanner;
  const ThemeHomeSections = theme.components.HomeSections;

  const { data: featuredProducts } = useFeaturedProducts(initialFeatured);
  const { data: newProducts } = useNewProducts(initialNew);
  const { data: rootSections } = useRootSections(initialSections);

  return (
    <>
      {Hero ? (
        <Hero banners={banners ?? []} />
      ) : (
        <BannerSlider banners={banners} />
      )}

      {featuredProducts && featuredProducts.length > 0 && (
        <ProductCarousel
          title={t('home.featured')}
          products={featuredProducts}
          viewAllLink="/catalog"
        />
      )}

      {newProducts && newProducts.length > 0 && (
        <ProductCarousel
          title={t('home.new')}
          products={newProducts}
          viewAllLink="/catalog"
        />
      )}

      {rootSections?.map((section) => (
        <SectionProductCarousel
          key={section.id}
          section={section}
          initialData={sectionProducts?.[section.id]}
        />
      ))}

      {ThemeHomeSections && <ThemeHomeSections />}
    </>
  );
}
