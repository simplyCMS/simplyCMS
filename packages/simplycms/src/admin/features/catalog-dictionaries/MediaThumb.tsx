import { resolveMediaUrl } from 'simplycms/domain/media';
import { ImageIcon } from 'lucide-react';

interface Props {
  /** 🔴 Референс сховища, а не URL (Е2-1) — резолвиться тут. */
  readonly reference: string | null;
  readonly alt: string;
  /** Розмір мініатюри: 40 — список розділів, 32 — таблиця опцій. */
  readonly size: 32 | 40;
}

/** Мініатюра зображення рядка довідника або нейтральна заглушка. */
export function MediaThumb({ reference, alt, size }: Props) {
  const thumb = resolveMediaUrl(reference);
  if (thumb)
    return (
      <img
        src={thumb}
        alt={alt}
        width={size}
        height={size}
        className="object-cover rounded"
        loading="lazy"
        decoding="async"
      />
    );
  return (
    <div
      className={`${size === 40 ? 'h-10 w-10' : 'h-8 w-8'} bg-muted rounded flex items-center justify-center`}
    >
      <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
