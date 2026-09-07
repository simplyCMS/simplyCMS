import { useBanners, type Banner, type BannerButton } from "@/hooks/useBanners";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface BannerSliderProps {
  placement?: string;
  sectionId?: string;
}

export function BannerSlider({ placement = "home", sectionId }: BannerSliderProps) {
  const { data: banners } = useBanners(placement, sectionId);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !banners?.length) return;
    emblaApi.on("select", onSelect);
    onSelect();

    const currentBanner = banners[emblaApi.selectedScrollSnap()];
    const duration = currentBanner?.slide_duration || 5000;

    const interval = setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, duration);

    return () => {
      clearInterval(interval);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect, banners]);

  if (!banners?.length) return null;

  return (
    <div className="relative group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner) => (
            <div key={banner.id} className="flex-[0_0_100%] min-w-0 relative">
              <BannerContent banner={banner} />
            </div>
          ))}
        </div>
      </div>

      {banners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === selectedIndex ? "w-6 bg-primary" : "w-2 bg-foreground/30"
                }`}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BannerContent({ banner }: { banner: Banner }) {
  const textAlign = banner.text_position === "center" ? "items-center text-center" : banner.text_position === "right" ? "items-end text-right" : "items-start";
  const gradientDir = banner.text_position === "right" ? "from-transparent to-black/40" : banner.text_position === "center" ? "from-black/30 via-black/20 to-black/30" : "from-black/40 to-transparent";

  return (
    <div className="relative aspect-[21/9] md:aspect-[3/1] bg-muted overflow-hidden">
      <picture>
        {banner.mobile_image_url && (
          <source media="(max-width: 768px)" srcSet={banner.mobile_image_url} />
        )}
        {banner.desktop_image_url && (
          <source media="(min-width: 769px)" srcSet={banner.desktop_image_url} />
        )}
        <img
          src={banner.image_url}
          alt={banner.title}
          className="w-full h-full object-cover"
          style={{
            animationDuration: `${banner.animation_duration}ms`,
          }}
        />
      </picture>
      <div
        className={`absolute inset-0 bg-gradient-to-r ${gradientDir} flex ${textAlign}`}
        style={{ backgroundColor: banner.overlay_color || undefined }}
      >
        <div className="container mx-auto px-4 flex flex-col justify-center h-full">
          <div className={`max-w-lg text-white flex flex-col ${textAlign}`}>
            <h2 className="text-2xl md:text-4xl font-serif font-bold mb-2">{banner.title}</h2>
            {banner.subtitle && (
              <p className="text-sm md:text-base opacity-90 mb-4">{banner.subtitle}</p>
            )}
            {banner.buttons.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {banner.buttons.map((btn, i) => (
                  <BannerButtonEl key={i} button={btn} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerButtonEl({ button }: { button: BannerButton }) {
  const baseClass = "inline-block px-6 py-2 rounded text-sm font-medium transition-colors";
  const variantClass =
    button.variant === "secondary"
      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      : button.variant === "outline"
      ? "border border-white text-white hover:bg-white/20"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  if (button.target === "_blank") {
    return (
      <a href={button.url} target="_blank" rel="noopener noreferrer" className={`${baseClass} ${variantClass}`}>
        {button.text}
      </a>
    );
  }

  return (
    <Link to={button.url || "#"} className={`${baseClass} ${variantClass}`}>
      {button.text}
    </Link>
  );
}
