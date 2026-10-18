import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { Skeleton } from 'simplycms/ui/skeleton';

/**
 * Мініатюра рядка кошика: `undefined` — скелетон (кеш іншої мови, квоти ще немає), `null` —
 * заглушка без фото. `alt` і `lang` — з даних, як на сторінці товару: `lang` на самому `<img>`
 * (мова елемента застосовується до його `alt`), порожній alt не підміняється назвою (Task 17б).
 */
export function CartItemThumb({
  image,
}: {
  image: ProductImageViewModel | null | undefined;
}) {
  return (
    <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
      {image === undefined ? (
        <Skeleton
          data-testid="cart-item-image-skeleton"
          className="absolute inset-0"
        />
      ) : image ? (
        <img
          src={image.url}
          alt={image.alt}
          lang={image.alt_lang ?? undefined}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <span className="text-2xl">&#x1F4E6;</span>
        </div>
      )}
    </div>
  );
}
