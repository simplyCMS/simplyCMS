import type {
  ProductDetailCharacteristics,
  ProductDetailDescription,
  ProductDetailSlots,
} from 'simplycms/contracts/views';
import { useT, type MessageKey } from 'simplycms/i18n';
import { Separator } from '@simplycms/ui/separator';
import { ProductCharacteristics } from '@simplycms/core/components/catalog/ProductCharacteristics';

const NAV_SECTIONS = [
  { id: 'section-description', labelKey: 'product.description' },
  { id: 'section-characteristics', labelKey: 'product.characteristics' },
  { id: 'section-availability', labelKey: 'product.availability' },
  { id: 'section-reviews', labelKey: 'product.reviews' },
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey }>;

/** Кнопка липкої навігації: плавний скрол до секції за її `id`. */
function SectionNavButton({ id, label }: { id: string; label: string }) {
  return (
    <button
      onClick={() =>
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }
      className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
    >
      {label}
    </button>
  );
}

/**
 * Нижня частина картки: липка навігація + опис, характеристики, наявність і
 * відгуки. Наявність і відгуки — реквізити (власні запити ядра).
 */
export function ProductDetailSections({
  description,
  characteristics,
  slots,
}: {
  description: ProductDetailDescription;
  characteristics: ProductDetailCharacteristics;
  slots: ProductDetailSlots;
}) {
  const t = useT();

  return (
    <>
      {/* Section navigation */}
      <div className="mt-12 sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b">
        <nav className="flex gap-1">
          {NAV_SECTIONS.map((item) => (
            <SectionNavButton
              key={item.id}
              id={item.id}
              label={t(item.labelKey)}
            />
          ))}
        </nav>
      </div>

      {/* Description section */}
      <section id="section-description" className="mt-8 scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">
          {t('product.description')}
        </h2>
        {description.html ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: description.html }}
          />
        ) : (
          <p className="text-muted-foreground">{t('product.noDescription')}</p>
        )}
      </section>

      <Separator className="my-8" />

      {/* Characteristics section */}
      <section id="section-characteristics" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">
          {t('product.characteristics')}
        </h2>
        <ProductCharacteristics propertyValues={characteristics.items} />
      </section>

      <Separator className="my-8" />

      {/* Availability section */}
      <section id="section-availability" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">
          {t('product.availabilityInStores')}
        </h2>
        {/* Реквізит: наявність по точках видачі */}
        <slots.StockAvailability />
      </section>

      <Separator className="my-8" />

      {/* Reviews section */}
      <section id="section-reviews" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">{t('product.reviews')}</h2>
        {/* Реквізит: відгуки */}
        <slots.Reviews />
      </section>
    </>
  );
}
