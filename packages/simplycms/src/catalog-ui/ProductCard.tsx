import { Link } from '@tanstack/react-router';
import { ImageIcon, Star } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import type { ThresholdHint } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { useFormatPrice } from 'simplycms/react-query';
import { productPath } from 'simplycms/domain';
import { FallbackText } from 'simplycms/ui/fallback-text';
import { DiscountHints } from './DiscountHints';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    /** Поточна адреса товару в мові сторінки (не адреса основної мови). */
    slug: string;
    short_description?: string | null;
    /**
     * Мова назви / короткого опису, коли текст узято з основної мови (fallback):
     * обгортка `lang` не дає скрінрідеру читати його вимовою мови сторінки (І37).
     * Ознака з даних проєкції; не задано — текст мовою сторінки.
     */
    name_lang?: string | null;
    short_description_lang?: string | null;
    /** Фото мовою сторінки; мініатюра — перше (alt і його `lang` — з даних, Task 17б). */
    images?: ProductImageViewModel[];
    section?: { slug: string } | null;
    has_modifications?: boolean;
    price?: number | null;
    old_price?: number | null;
    stock_status?: string;
    /** Порогові підказки знижок (Е6в-12); до середовища цін — немає. */
    discount_hints?: readonly ThresholdHint[];
  };
  rating?: { avgRating: number; reviewCount: number } | null;
}

export function ProductCard({ product, rating }: ProductCardProps) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const firstImage = product.images?.[0];
  const price = product.price ?? undefined;
  const oldPrice = product.old_price;
  const stockStatus = product.stock_status ?? 'in_stock';
  // Мови тут не передаємо: префікс дописує `rewrite` роутера (мова поточної сторінки).
  const path = productPath({ path: product.slug });

  return (
    <Link to={path.to} params={path.params}>
      <div className="group h-full overflow-hidden rounded-lg border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="aspect-square overflow-hidden bg-muted relative">
          {firstImage ? (
            // `lang` на самому `<img>`: атрибут мови елемента застосовується до його `alt`,
            // а обгортка-`span` (`FallbackText`) змінила б розмітку абсолютно позиціонованого фото.
            <img
              src={firstImage.url}
              alt={firstImage.alt}
              lang={firstImage.alt_lang ?? undefined}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon
                className="h-12 w-12 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
          {stockStatus === 'on_order' && (
            <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded border border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              {t('product.onOrder')}
            </span>
          )}
          {stockStatus === 'out_of_stock' && (
            <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
              {t('product.outOfStock')}
            </span>
          )}
          {oldPrice && price && oldPrice > price && (
            <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground">
              -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors mb-2">
            <FallbackText lang={product.name_lang}>{product.name}</FallbackText>
          </h3>
          {product.short_description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              <FallbackText lang={product.short_description_lang}>
                {product.short_description}
              </FallbackText>
            </p>
          )}
          <div className="flex items-baseline gap-2">
            {price !== undefined && (
              <span className="text-lg font-bold text-primary">
                {formatPrice(price)}
              </span>
            )}
            {oldPrice && price && oldPrice > price && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(oldPrice)}
              </span>
            )}
          </div>
          {product.discount_hints && (
            <DiscountHints hints={product.discount_hints} className="mt-1" />
          )}
          {rating && rating.reviewCount > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-medium">{rating.avgRating}</span>
              <span className="text-xs text-muted-foreground">
                ({rating.reviewCount})
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
