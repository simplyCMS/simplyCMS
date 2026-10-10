/**
 * Заглушка `ImageUpload` для юнітів картки: справжнє завантаження файлів
 * поза юнітом, а контракт props (entityId, eraseOnRemove) видно в DOM.
 */
export const ImageUpload = (p: {
  images: string[];
  onImagesChange: (i: string[]) => void;
  entityType: string;
  entityId?: string | null;
  eraseOnRemove?: boolean;
}) => (
  <div
    data-testid="image-upload"
    data-entity-type={p.entityType}
    data-entity-id={p.entityId ?? ''}
    data-erase={String(p.eraseOnRemove)}
  >
    <button
      type="button"
      onClick={() => p.onImagesChange(['banner/n/new.jpg'])}
    >
      add-image
    </button>
    <button type="button" onClick={() => p.onImagesChange([])}>
      clear-image
    </button>
  </div>
);
