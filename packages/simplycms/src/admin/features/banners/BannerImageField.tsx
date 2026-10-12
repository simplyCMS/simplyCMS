import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Label } from 'simplycms/ui/label';
import { ImageUpload } from '../../components/ImageUpload';
import type { BannerFormInput, BannerFormValues } from './banner-form-schema';

type Form = UseFormReturn<BannerFormInput, unknown, BannerFormValues>;

interface Props {
  readonly form: Form;
  readonly name: 'imageUrl' | 'desktopImageUrl' | 'mobileImageUrl';
  readonly label: string;
  /** id рядка або згенерований НАПЕРЕД id нового банера (Е6д-1). */
  readonly entityId: string;
  readonly error?: string;
}

/**
 * Одне зображення банера. 🔴 Прибраний файл стирає збереження форми (опція
 * `media` фабрики, після COMMIT), а не компонент: скасована форма інакше
 * лишила б банер із посиланням на вже зниклий файл.
 */
export function BannerImageField({
  form,
  name,
  label,
  entityId,
  error,
}: Props) {
  const value = useWatch({ control: form.control, name });
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ImageUpload
        images={value ? [value] : []}
        onImagesChange={(next) =>
          form.setValue(name, next[0] ?? '', { shouldDirty: true })
        }
        entityType="banner"
        entityId={entityId}
        maxImages={1}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
