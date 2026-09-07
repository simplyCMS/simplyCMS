import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2, GripVertical, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  folder?: string;
  bucket?: string;
  maxImages?: number;
  disabled?: boolean;
}

export function ImageUpload({
  images,
  onImagesChange,
  folder = "products",
  bucket = "product-images",
  maxImages = 10,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
    
    if (!fileExt || !allowedExts.includes(fileExt)) {
      toast({
        variant: "destructive",
        title: "Непідтримуваний формат",
        description: "Дозволені формати: JPG, PNG, WebP, GIF",
      });
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Файл занадто великий",
        description: "Максимальний розмір: 5 МБ",
      });
      return null;
    }

    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Помилка завантаження",
        description: error.message,
      });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        variant: "destructive",
        title: "Ліміт досягнуто",
        description: `Максимум ${maxImages} зображень`,
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map((file) => uploadFile(file));
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((url): url is string => url !== null);

      if (successfulUploads.length > 0) {
        onImagesChange([...images, ...successfulUploads]);
        toast({
          title: "Завантажено",
          description: `${successfulUploads.length} зображень додано`,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [images, maxImages, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeImage = async (index: number) => {
    const imageUrl = images[index];
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);

    // Try to delete from storage
    try {
      const url = new URL(imageUrl);
      const bucketPattern = new RegExp(`\\/${bucket}\\/(.+)$`);
      const pathMatch = url.pathname.match(bucketPattern);
      if (pathMatch) {
        await supabase.storage.from(bucket).remove([pathMatch[1]]);
      }
    } catch (e) {
      // Ignore deletion errors for external URLs
    }
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const newImages = [...images];
    const [moved] = newImages.splice(from, 1);
    newImages.splice(to, 0, moved);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled && !isUploading) {
            document.getElementById("image-upload-input")?.click();
          }
        }}
      >
        <input
          id="image-upload-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={disabled || isUploading}
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Завантаження...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Перетягніть зображення сюди</p>
              <p className="text-xs text-muted-foreground">
                або натисніть для вибору (JPG, PNG, WebP, GIF до 5 МБ)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, index) => (
            <div
              key={url}
              className="relative group aspect-square bg-muted rounded-lg overflow-hidden"
            >
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(index, index - 1);
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
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
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
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(index, index + 1);
                    }}
                  >
                    →
                  </Button>
                )}
              </div>
              {/* First image badge */}
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                  Головне
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {images.length} / {maxImages} зображень
      </p>
    </div>
  );
}
