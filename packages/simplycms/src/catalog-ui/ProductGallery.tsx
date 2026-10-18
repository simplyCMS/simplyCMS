import { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { cn } from 'simplycms/ui/utils';

interface ProductGalleryProps {
  /** Фото мовою сторінки: `alt` і його `lang` (fallback основної) — з даних (Task 17б). */
  images: ProductImageViewModel[];
}

/**
 * Галерея картки товару. `alt` кожного фото — з даних мови сторінки, а не назва товару:
 * порожній alt (фото без опису) лишається порожнім. `lang` стоїть на самому `<img>` —
 * атрибут мови елемента застосовується до його `alt` (І37), без обгорток у розмітці фото.
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const t = useT();
  const [currentIndex, setCurrentIndex] = useState(0);

  const hasImages = images.length > 0;
  const currentImage = hasImages ? images[currentIndex] : null;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="aspect-square rounded-lg bg-muted overflow-hidden cursor-zoom-in relative group">
        {currentImage ? (
          <img
            src={currentImage.url}
            alt={currentImage.alt}
            lang={currentImage.alt_lang ?? undefined}
            className="absolute inset-0 w-full h-full object-contain transition-transform group-hover:scale-105"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-24 w-24 text-muted-foreground" />
          </div>
        )}

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md bg-secondary"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md bg-secondary"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              // Ім'я кнопки — номер фото: alt фото може бути порожнім, а кнопка без імені для
              // скрінрідера німа. Сама мініатюра тоді декоративна (`alt=""`), як у теми default.
              aria-label={t('product.galleryThumb', { index: index + 1 })}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors',
                index === currentIndex
                  ? 'border-primary'
                  : 'border-transparent hover:border-muted-foreground/50',
              )}
            >
              <img
                src={image.url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
