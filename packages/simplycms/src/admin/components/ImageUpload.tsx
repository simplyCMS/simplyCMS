import { useState, useCallback } from 'react';
import { uploadMedia } from 'simplycms/admin-server';
import {
  MAX_UPLOAD_BYTES,
  PAYLOAD_TOO_LARGE_CODE,
  type MediaEntityType,
} from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import { useToast } from 'simplycms/core/hooks/use-toast';
import { ImageDropzone } from './ImageDropzone';
import { ImageGrid } from './ImageGrid';

interface ImageUploadBase {
  /** 🔴 РЕФЕРЕНСИ сховища, не URL (рішення Е2-1). */
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

/**
 * Власник файлу обовʼязковий (К3-Е6д-3): `entityId` потрібен усім типам,
 * крім `store_logo` — його власника сервер підставляє сам.
 * Прибраний з форми файл стирає збереження форми (опція `media` фабрики), а не
 * цей компонент.
 */
type ImageUploadProps = ImageUploadBase &
  (
    | { entityType: Exclude<MediaEntityType, 'store_logo'>; entityId: string }
    | { entityType: 'store_logo'; entityId?: undefined }
  );

export function ImageUpload({
  images,
  onImagesChange,
  entityType,
  entityId,
  maxImages = 10,
  disabled = false,
}: ImageUploadProps) {
  const t = useT();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      // Клієнтська стеля — лише щоб не гнати мегабайти заради відмови;
      // джерело правди про розмір і формат — сервер (`inspectUpload`).
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({
          variant: 'destructive',
          title: t('admin.products.upload.tooLarge'),
          description: t('admin.products.upload.maxSize'),
        });
        return null;
      }
      const body = new FormData();
      body.set('file', file);
      body.set('entityType', entityType);
      if (entityId !== undefined) body.set('entityId', entityId);
      try {
        // 🔴 Повертається РЕФЕРЕНС, а не URL: у колонку сутності лягає він
        // (рішення Е2-1), а `url` — лише для прев'ю в цій формі.
        const { ref } = await uploadMedia({ data: body });
        return ref;
      } catch (error) {
        const badFormat =
          error instanceof Error && error.message === 'media/bad-format';
        if (
          error instanceof Error &&
          error.message === PAYLOAD_TOO_LARGE_CODE
        ) {
          toast({
            variant: 'destructive',
            title: t('errors.payloadTooLarge'),
          });
          return null;
        }
        toast({
          variant: 'destructive',
          title: badFormat
            ? t('admin.products.upload.badFormat')
            : t('admin.products.upload.failed'),
          description: badFormat
            ? t('admin.products.upload.allowedFormats')
            : undefined,
        });
        return null;
      }
    },
    [entityType, entityId, toast, t],
  );

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;

      const remainingSlots = maxImages - images.length;
      if (remainingSlots <= 0) {
        toast({
          variant: 'destructive',
          title: t('admin.products.upload.limit'),
          description: t('admin.products.upload.limitHint', {
            count: maxImages,
          }),
        });
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      setIsUploading(true);

      try {
        const results = await Promise.all(filesToUpload.map(uploadFile));
        const uploaded = results.filter((ref): ref is string => ref !== null);

        if (uploaded.length > 0) {
          onImagesChange([...images, ...uploaded]);
          toast({
            title: t('admin.products.upload.done'),
            description: t('admin.products.upload.doneHint', {
              count: uploaded.length,
            }),
          });
        }
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, maxImages, images, onImagesChange, toast, t, uploadFile],
  );

  const removeImage = (index: number) =>
    onImagesChange(images.filter((_, i) => i !== index));

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onImagesChange(next);
  };

  return (
    <div className="space-y-3">
      <ImageDropzone
        onFiles={handleFileSelect}
        isUploading={isUploading}
        disabled={disabled}
      />

      <ImageGrid
        images={images}
        maxImages={maxImages}
        onMove={moveImage}
        onRemove={removeImage}
        disabled={disabled}
      />
    </div>
  );
}
