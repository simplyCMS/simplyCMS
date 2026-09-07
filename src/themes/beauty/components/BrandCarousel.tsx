import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function BrandCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 2 },
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["beauty-brands"],
    queryFn: async () => {
      // Find the "brand" property and get its options
      const { data: properties } = await supabase
        .from("section_properties")
        .select("id, slug")
        .eq("has_page", true)
        .limit(10);

      if (!properties?.length) return [];

      // Get options with images for the first property that has page (likely brands)
      const brandProp = properties[0];
      const { data: options } = await supabase
        .from("property_options")
        .select("id, name, slug, image_url")
        .eq("property_id", brandProp.id)
        .order("sort_order");

      return (options || []).map((o) => ({
        ...o,
        propertySlug: brandProp.slug,
      }));
    },
  });

  if (!brands?.length) return null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-serif font-bold text-foreground text-center mb-8 uppercase tracking-wider">
          Бренди
        </h2>

        <div className="relative group">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {brands.map((brand) => (
                <div key={brand.id} className="flex-[0_0_120px] md:flex-[0_0_150px] min-w-0">
                  <Link
                    to={`/properties/${brand.propertySlug}/${brand.slug}`}
                    className="flex items-center justify-center h-20 rounded-md border border-border/40 bg-card hover:border-primary/30 transition-colors p-4"
                  >
                    {brand.image_url ? (
                      <img
                        src={brand.image_url}
                        alt={brand.name}
                        className="max-h-full max-w-full object-contain opacity-60 hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium text-center">
                        {brand.name}
                      </span>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
