import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
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
      <Dialog>
        <DialogTrigger asChild>
          <div className="aspect-square rounded-lg bg-muted overflow-hidden cursor-zoom-in relative group">
            {currentImage ? (
              <img
                src={currentImage}
                alt={productName}
                className="w-full h-full object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
            
            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          {currentImage && (
            <div className="relative">
              <img
                src={currentImage}
                alt={productName}
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    onClick={goToPrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors",
                index === currentIndex
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/50"
              )}
            >
              <img
                src={image}
                alt={`${productName} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
