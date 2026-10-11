import { useEffect, useId, useRef, useState } from 'react';
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

// Стабільні ключі списку: за індексом прибрання першого фото перемонтувало б
// решту превʼю (і перевідкликало їхні URL).
const fileIds = new WeakMap<File, number>();
let nextFileId = 0;
const fileKey = (file: File) => {
  if (!fileIds.has(file)) fileIds.set(file, nextFileId++);
  return fileIds.get(file);
};

/**
 * Превʼю одного файла. Blob-URL створює й відкликає `useEffect`, а не
 * cleanup ref-колбека: React 18 (peer пакета `^18 || ^19`) його не викликає,
 * тож URL текли б. Ефект не виконується у відкинутому рендері (на відміну від
 * `useMemo`), а в StrictMode пара створення/відклик симетрична.
 */
function PhotoPreview({ file, alt }: { file: File; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // src задаємо напряму, не через стан: setState в ефекті дав би зайвий
    // рендер (і лінт-попередження). Розмір фіксований класом, тож до появи
    // src розкладка не стрибає.
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <img ref={imgRef} alt={alt} className="h-16 w-16 rounded-md object-cover" />
  );
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
  const handleSelect = (picked: File[]) => {
    const allowed = accept.split(',').map((m) => m.trim());
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
            <li key={fileKey(file)} className="relative">
              <PhotoPreview
                file={file}
                alt={t('reviews.photoAlt', { index: i + 1 })}
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
