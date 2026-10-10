import { resolveMediaUrl } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';

/**
 * Фото відгуку. Сервер віддає РЕФЕРЕНСИ (Е6д-11) — URL збирає клієнт;
 * клік відкриває оригінал в новій вкладці.
 */
export default function ReviewPhotos({
  images,
}: {
  readonly images: readonly string[];
}) {
  const t = useT();
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {images.map((ref, i) => {
        const url = resolveMediaUrl(ref);
        if (url === null) return null;
        return (
          <a key={ref} href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={t('admin.reviews.photo', { index: i + 1 })}
              loading="lazy"
              className="h-24 w-24 rounded-md border object-cover"
            />
          </a>
        );
      })}
    </div>
  );
}
