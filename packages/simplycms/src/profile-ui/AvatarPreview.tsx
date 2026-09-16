interface AvatarPreviewProps {
  /** Готовий URL картинки або `null` — тоді показуються ініціали. */
  url: string | null;
  initials: string;
  alt: string;
}

/**
 * Кругле прев'ю аватара: картинка або ініціали.
 *
 * 🔴 Винесено з `AvatarUpload` заради канону 150 рядків на файл, і межа
 * пройшла саме тут: це єдина частина компонента БЕЗ стану й побічних дій —
 * чиста функція від «що показати». Логіка завантаження лишилась цілою.
 */
export function AvatarPreview({ url, initials, alt }: AvatarPreviewProps) {
  return (
    <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-medium">
      {url ? (
        <img
          src={url}
          alt={alt}
          width={96}
          height={96}
          className="rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials
      )}
    </div>
  );
}
