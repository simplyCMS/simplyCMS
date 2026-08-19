import type { Banner } from '@simplycms/objects/objects';
import { HomeView } from '../views/HomeView';
import { useStorefrontViews } from '../views/useStorefrontViews';
import {
  useFeaturedProducts,
  useNewProducts,
  useRootSections,
} from './home/queries';
import { HomeSlotBindings } from './home/slot-context';
import { homeSlots } from './home/slots';
import { toCardViewModel } from './home/toCardViewModel';
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
 * Контейнер головної: тягне добірки й кореневі секції — і віддає готовий
 * view-model view (темовому, якщо тема заявила `Home`, інакше канонічному).
 */
export default function HomePage({
  banners,
  featuredProducts: initialFeatured,
  newProducts: initialNew,
  sections: initialSections,
  sectionProducts,
}: HomePageProps) {
  const { data: featuredProducts } = useFeaturedProducts(initialFeatured);
  const { data: newProducts } = useNewProducts(initialNew);
  const { data: rootSections } = useRootSections(initialSections);
  const views = useStorefrontViews({ Home: HomeView });

  const sections = rootSections ?? [];

  return (
    <HomeSlotBindings
      value={{
        sections: Object.fromEntries(
          sections.map((section) => [
            section.id,
            { section, initialData: sectionProducts?.[section.id] },
          ]),
        ),
      }}
    >
      <views.Home
        hero={{ banners: banners ?? [] }}
        featured={{ products: toCardViewModel(featuredProducts ?? []) }}
        newArrivals={{ products: toCardViewModel(newProducts ?? []) }}
        sections={{ items: sections }}
        slots={homeSlots}
      />
    </HomeSlotBindings>
  );
}
