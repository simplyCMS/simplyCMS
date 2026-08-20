import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  ProductDetailGallery,
  ProductDetailSummary,
} from 'simplycms/contracts/views';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { MONO_STACK } from '../../components/mono';
import type { ThemeKey } from '../../messages';

/** Мініатюра: активна — кільце `primary`, решта — рамка, ховер її підсвічує. */
function thumbClass(isActive: boolean): string {
  return [
    'aspect-square rounded-sm bg-card p-3',
    'transition-all duration-200 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-2',
    isActive
      ? 'ring-2 ring-primary'
      : 'ring-1 ring-border hover:ring-muted-foreground/40',
  ].join(' ');
}

/**
 * Картка галереї — ліва половина сітки картки товару.
 *
 * Вимір референсу: біла картка `p-6 sm:p-8`, всередині рамка `bg-gray-50/70`
 * з радіусом 18px (`rounded-sm` = `calc(var(--radius) - 4px)`), фото
 * `object-contain` із зумом `scale-105` за 500 мс, під нею — рівно чотири
 * мініатюри в ряд (`grid-cols-4 gap-3`).
 *
 * `useState` активного фото — це UI-стан рендеру, а не запит даних: чистота
 * view (вимога контракту v3) ним не порушується. Канонічний view робить те
 * саме всередині `ProductGallery` ядра.
 */
export function ProductGalleryCard({
  gallery,
  summary,
}: {
  gallery: ProductDetailGallery;
  summary: ProductDetailSummary;
}) {
  const tt = useThemeT<ThemeKey>();
  const [activeIndex, setActiveIndex] = useState(0);
  const images = gallery.images;
  const current = images[activeIndex] ?? images[0] ?? null;

  return (
    <div className="flex flex-col rounded-lg bg-card p-6 sm:p-8">
      <div className="group relative min-h-[320px] flex-1 overflow-hidden rounded-sm bg-muted/50 p-4 sm:min-h-[420px] sm:p-6">
        {summary.discountPercent !== null && (
          <span
            className="absolute left-4 top-4 z-10 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent"
            style={{ fontFamily: MONO_STACK }}
          >
            −{summary.discountPercent}%
          </span>
        )}

        {current ? (
          <img
            src={current}
            alt={summary.name}
            className="h-full w-full object-contain transition-transform duration-500 ease-in-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[288px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10" />
            <span className="text-sm">{tt('theme.view.noImage')}</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {images.slice(0, 4).map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={tt('theme.view.photo', { number: index + 1 })}
              aria-current={index === activeIndex}
              className={thumbClass(index === activeIndex)}
            >
              <img
                src={image}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
