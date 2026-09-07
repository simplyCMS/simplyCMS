import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, Star } from "lucide-react";

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
      <Card className="group h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="aspect-square overflow-hidden bg-muted relative">
          {firstImage ? (
            <img
              src={firstImage}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {stockStatus === "on_order" && (
            <Badge variant="outline" className="absolute top-2 right-2 border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              Під замовлення
            </Badge>
          )}
          {stockStatus === "out_of_stock" && (
            <Badge variant="secondary" className="absolute top-2 right-2">
              Немає в наявності
            </Badge>
          )}
          {oldPrice && price && oldPrice > price && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>
    </Link>
  );
}
