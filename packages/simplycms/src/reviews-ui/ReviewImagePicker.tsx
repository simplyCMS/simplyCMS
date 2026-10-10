import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useT, type MessageKey } from 'simplycms/i18n';

/**
 * Контракт `renderImageUpload` (Е6д-6): тема отримує `File[]`, а не URL-и —
 * файли їдуть на сервер разом з відгуком одним запитом, тож орфанів немає.
 */
export interface ReviewImageUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles: number;
  /** Значення атрибута `accept` (MIME через кому). */
  accept: string;
  maxBytes: number;
}

/**
 * Штатний вибір фото відгуку. Клієнтські перевірки — лише зручність: сервер
 * перевіряє тип за вмістом і розмір незалежно, тож тут вони не довіра.
 */
export function ReviewImagePicker({
  files,
  onFilesChange,
  maxFiles,
  accept,
  maxBytes,
}: ReviewImageUploadProps) {
  const t = useT();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  // Blob-URL тримає файл у памʼяті, доки його не відкликано. Набір URL
  // рахується разом із `files`, а ефект відкликає попередній набір і при
  // зміні, і при розмонтуванні (файлів при монтуванні немає, тож подвійний
  // ефект StrictMode нічого не ревокує зайвого).
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const handleSelect = (picked: File[]) => {
    const allowed = accept.split(',');
    const accepted = [...files];
    let rejection: MessageKey | null = null;
    for (const file of picked) {
      if (!allowed.includes(file.type))
        rejection = 'reviews.errors.imageBadFormat';
      else if (file.size > maxBytes) rejection = 'reviews.errors.imageTooLarge';
      else if (accepted.length >= maxFiles)
        rejection = 'reviews.errors.tooManyImages';
      else accepted.push(file);
    }
    setErrorKey(rejection);
    if (accepted.length !== files.length) onFilesChange(accepted);
    // Скидання значення дозволяє вибрати той самий файл ще раз.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm underline cursor-pointer">
        {t('reviews.form.addPhotos')}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        data-testid="review-images-input"
        className="sr-only"
        onChange={(e) => handleSelect(Array.from(e.target.files ?? []))}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="relative">
              <img
                src={urls[i]}
                alt={t('reviews.photoAlt', { index: i + 1 })}
                className="h-16 w-16 rounded-md object-cover"
              />
              <button
                type="button"
                aria-label={t('reviews.form.removePhoto')}
                className="absolute -right-1 -top-1 rounded-full bg-background border p-0.5"
                onClick={() => {
                  setErrorKey(null);
                  onFilesChange(files.filter((_, j) => j !== i));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorKey && (
        <p role="alert" className="text-xs text-destructive">
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}
