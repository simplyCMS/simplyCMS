import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BeautyProductCard } from "./ProductCard";

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  images?: string[];
  section?: { slug: string } | null;
  price?: number | null;
  old_price?: number | null;
  stock_status?: string | null;
}

interface ProductCarouselProps {
  title: string;
  products: Product[];
  viewAllLink?: string;
}

export function ProductCarousel({ title, products, viewAllLink }: ProductCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll: 1,
  });

  if (!products.length) return null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif font-bold text-foreground uppercase tracking-wider">
            {title}
          </h2>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm text-primary hover:underline font-medium"
            >
              Переглянути усі →
            </Link>
          )}
        </div>

        <div className="relative group">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex-[0_0_calc(50%-8px)] sm:flex-[0_0_calc(33.333%-11px)] lg:flex-[0_0_calc(25%-12px)] min-w-0"
                >
                  <BeautyProductCard product={product} />
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-3 top-1/3 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/3 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
