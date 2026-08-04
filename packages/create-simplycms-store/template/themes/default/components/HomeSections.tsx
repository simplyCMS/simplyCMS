import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { BrandCarousel } from './BrandCarousel';
import { NewsletterSection } from './NewsletterSection';
import { BlogPreview } from './BlogPreview';

/**
 * Унікальні секції головної default-теми.
 *
 * Ядро рендерить цей слот ПІСЛЯ канонічних секцій і без пропсів — дані
 * компоненти тягнуть самі. Бренди/розсилка/блог не канонічні: це вибір саме
 * цієї теми, тому вони живуть тут, а не в ядрі.
 *
 * `BrandCarousel` не має власної перевірки налаштування (на відміну від
 * `NewsletterSection` і `BlogPreview`), тому гейт `showBrandCarousel`
 * лишається тут — рівно як було в колишній `pages/HomePage.tsx`.
 */
export function HomeSections() {
  const showBrands = useThemeSettings<boolean>('showBrandCarousel');

  return (
    <>
      {showBrands !== false && <BrandCarousel />}
      <NewsletterSection />
      <BlogPreview />
    </>
  );
}
