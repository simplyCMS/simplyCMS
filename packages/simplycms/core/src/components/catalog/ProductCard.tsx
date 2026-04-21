import { Link } from "@tanstack/react-router";
import { ImageIcon, Star } from "lucide-react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    short_description?: string | null;
    images?: string[];
    section?: { slug: string } | null;
    has_modifications?: boolean;
    price?: number | null;
    old_price?: number | null;
    stock_status?: string | null;
  };
  rating?: { avgRating: number; reviewCount: number } | null;
}

export function ProductCard({ product, rating }: ProductCardProps) {
  const firstImage = product.images?.[0];
  const price = product.price ?? undefined;
  const oldPrice = product.old_price;
  const stockStatus = product.stock_status ?? "in_stock";
  const sectionSlug = product.section?.slug || "";

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Link to={`/catalog/${sectionSlug}/${product.slug}`}>
      <div className="group h-full overflow-hidden rounded-lg border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="aspect-square overflow-hidden bg-muted relative">
          {firstImage ? (
            <img
              src={firstImage}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          {stockStatus === "on_order" && (
            <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded border border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              Пiд замовлення
            </span>
          )}
          {stockStatus === "out_of_stock" && (
            <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
              Немає в наявностi
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
            {product.name}
          </h3>
          {product.short_description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {product.short_description}
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
          {rating && rating.reviewCount > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-medium">{rating.avgRating}</span>
              <span className="text-xs text-muted-foreground">({rating.reviewCount})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
