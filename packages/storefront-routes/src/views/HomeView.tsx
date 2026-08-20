import type { HomeViewModel } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { BannerSlider } from '../components/BannerSlider';
import { ProductCarousel } from '../components/ProductCarousel';
import { useActiveThemeModule } from '../shells/useActiveThemeModule';

/**
 * Канонічний view головної (контракт тем v3).
 *
 * 🔴 На відміну від решти канонічних view, тут звично читається активна
 * тема (`useActiveThemeModule`) — це НЕ порушення чистоти. Контракт v2.2
 * (`theme.components.HeroBanner` / `HomeSections`) старший за `theme.views`
 * і живе окремо (спека §9, план Ф5): сторінка сьогодні рендерить hero й
 * секції теми саме так, і цей канонічний view відтворює ту саму поведінку.
 * Читання контексту теми — той самий клас render-контекстного хука, що й
 * `useT`; жодного фетчу тут немає (сам `HomeSections` теми фетчить дані
 * свідомо — спека §6, звіт Ф1).
 */
export function HomeView({
  hero,
  featured,
  newArrivals,
  sections,
  slots,
}: HomeViewModel) {
  const t = useT();
  const theme = useActiveThemeModule();
  const Hero = theme.components.HeroBanner;
  const ThemeHomeSections = theme.components.HomeSections;

  return (
    <>
      {Hero ? (
        <Hero banners={hero.banners} />
      ) : (
        <BannerSlider banners={hero.banners} />
      )}

      {featured.products.length > 0 && (
        <ProductCarousel
          title={t('home.featured')}
          products={featured.products}
          viewAllLink="/catalog"
        />
      )}

      {newArrivals.products.length > 0 && (
        <ProductCarousel
          title={t('home.new')}
          products={newArrivals.products}
          viewAllLink="/catalog"
        />
      )}

      {sections.items.map((section) => (
        <slots.SectionCarousel key={section.id} sectionId={section.id} />
      ))}

      {ThemeHomeSections && <ThemeHomeSections />}
    </>
  );
}
