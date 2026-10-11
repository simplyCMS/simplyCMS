import { X } from 'lucide-react';
import { useT } from 'simplycms/i18n';

/** Фото відгуку, що вже збережене на сервері: референс (для `keep`) і URL показу. */
export interface ExistingPhoto {
  ref: string;
  url: string;
}

interface Props {
  photos: readonly ExistingPhoto[];
  onRemove: (ref: string) => void;
}

/**
 * Наявні фото у формі правки (Е6д-23). Прибране тут просто не потрапляє в
 * `keep`: стирання робить сервер після COMMIT, не клієнт.
 */
export function KeptPhotos({ photos, onRemove }: Props) {
  const t = useT();
  if (photos.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid="review-kept-photos">
      {photos.map((photo, i) => (
        <li key={photo.ref} className="relative">
          <img
            src={photo.url}
            alt={t('reviews.photoAlt', { index: i + 1 })}
            className="h-16 w-16 rounded-md object-cover"
          />
          <button
            type="button"
            aria-label={t('reviews.form.removePhoto')}
            className="absolute -right-1 -top-1 rounded-full bg-background border p-0.5"
            onClick={() => onRemove(photo.ref)}
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
