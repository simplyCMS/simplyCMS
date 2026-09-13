import { X } from 'lucide-react';
import { resolveMediaUrl } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';

interface ImageGridProps {
  /** 🔴 РЕФЕРЕНСИ, не URL (рішення Е2-1): у URL їх переводить рендер. */
  images: string[];
  maxImages: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * Сітка прев'ю завантажених зображень.
 *
 * 🔴 Чиста функція від props: рух і видалення лише піднімаються колбеками,
 * жодного виклику serverFn тут немає. Саме тому мутація лишається в одному
 * місці — `ImageUpload`, — а цей файл тримає обидва під каноном 150 рядків.
 */
export function ImageGrid({
  images,
  maxImages,
  onMove,
  onRemove,
  disabled = false,
}: ImageGridProps) {
  const t = useT();

  return (
    <>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((ref, index) => (
            <div
              key={ref}
              className="relative group aspect-square bg-muted rounded-lg overflow-hidden"
            >
              <img
                src={resolveMediaUrl(ref) ?? undefined}
                alt={`Image ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {/* Накладка з діями */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index - 1);
                    }}
                  >
                    ←
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
                {index < images.length - 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index + 1);
                    }}
                  >
                    →
                  </Button>
                )}
              </div>
              {/* Бейдж головного зображення */}
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                  {t('admin.products.upload.primary')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {images.length} / {maxImages} {t('admin.products.upload.imagesWord')}
      </p>
    </>
  );
}
