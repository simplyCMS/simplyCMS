import { ArrowLeft } from 'lucide-react';
import type { ProductDetailViewModel } from 'simplycms/contracts/views';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { ThemeKey } from '../messages';
import { ViewBreadcrumbs } from './parts/ViewBreadcrumbs';
import { ViewLink } from './parts/ViewLink';
import { ProductGalleryCard } from './product/ProductGalleryCard';
import { ProductPanels } from './product/ProductPanels';
import { ProductSummaryCard } from './product/ProductSummaryCard';

/**
 * View картки товару default-теми (контракт тем v3).
 *
 * Спека — `docs/design-references/ref/views/ProductDetail.spec.md` (локальний
 * артефакт, поза git). Розкладка знята з референсу: дві білі картки на сірому
 * полотні замість суцільної сторінки, під ними — окремі панелі опису,
 * характеристик, наявності й відгуків замість липких табів канону.
 *
 * 🔴 Чиста функція від view-model: жодних запитів. Дозволені лише
 * render-контекстні хуки (`useT`/`useThemeT`) і локальний UI-стан галереї.
 * Усе комерційне приходить готовим у `slots` — тема його лише розставляє.
 */
export function ProductDetailView({
  breadcrumbs,
  gallery,
  summary,
  description,
  characteristics,
  slots,
}: ProductDetailViewModel) {
  const tt = useThemeT<ThemeKey>();

  // «Назад» веде на найглибшу ланку крихт із href — розділ товару, а без
  // нього каталог. Окремого поля в vm немає, і вигадувати його не треба:
  // крихти вже несуть цю навігацію.
  const backHref =
    [...breadcrumbs].reverse().find((item) => item.href)?.href ?? '/catalog';
  const sectionLabel = breadcrumbs[breadcrumbs.length - 2]?.label ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <nav className="mb-6 flex items-center justify-between gap-4">
        <ViewLink
          to={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-in-out hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tt('theme.view.back')}
        </ViewLink>
        <ViewBreadcrumbs items={breadcrumbs} className="hidden sm:flex" />
      </nav>

      <section className="grid gap-4 md:gap-6 lg:grid-cols-2 lg:items-stretch">
        <ProductGalleryCard gallery={gallery} summary={summary} />
        <ProductSummaryCard
          summary={summary}
          characteristics={characteristics}
          slots={slots}
          sectionLabel={sectionLabel}
        />
      </section>

      <ProductPanels
        description={description}
        characteristics={characteristics}
        slots={slots}
      />

      {/* Реквізит: точка розширення плагінів після вмісту сторінки */}
      <slots.PluginAfter />
    </div>
  );
}
