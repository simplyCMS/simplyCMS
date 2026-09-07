import { Link } from "react-router-dom";
import { Image, Star } from "lucide-react";

interface BeautyProductCardProps {
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
}

export function BeautyProductCard({ product }: BeautyProductCardProps) {
  const firstImage = product.images?.[0];
  const price = product.price ?? undefined;
  const oldPrice = product.old_price;
  const sectionSlug = product.section?.slug || "";

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);

  const discountPercent =
    oldPrice && price && oldPrice > price
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : null;

  return (
    <Link to={`/catalog/${sectionSlug}/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted mb-3">
        {firstImage ? (
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        {discountPercent && (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
            -{discountPercent}%
          </span>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 text-muted-foreground">
          <Star className="h-3 w-3 fill-muted-foreground/30 text-muted-foreground/30" />
          <span className="text-xs">(0)</span>
        </div>

        <div className="flex items-baseline gap-2">
          {price !== undefined && (
            <span className="text-sm font-bold text-foreground">
              {formatPrice(price)}
            </span>
          )}
          {oldPrice && price && oldPrice > price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(oldPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
