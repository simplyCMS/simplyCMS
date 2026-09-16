import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import { cn } from 'simplycms/ui/utils';

interface ImageDropzoneProps {
  onFiles: (files: FileList | null) => void;
  isUploading: boolean;
  disabled?: boolean;
}

/**
 * Зона перетягування й прихований `<input type="file">`.
 *
 * 🔴 Інпут адресується `ref`, а не `getElementById`: на сторінці банера
 * компонент стоїть ТРИЧІ, і спільний literal-`id` відкривав би діалог
 * першого інпута з будь-якої з трьох зон.
 *
 * 🔴 `accept` — з `ACCEPT_ATTRIBUTE` (T1), не рядком: список форматів має
 * рівно одну копію, і вона спільна із серверним сніфером.
 */
export function ImageDropzone({
  onFiles,
  isUploading,
  disabled = false,
}: ImageDropzoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(e.dataTransfer.files);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onClick={() => {
        if (!disabled && !isUploading) inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
        disabled={disabled || isUploading}
      />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {t('common.loading')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {t('admin.products.upload.dropHere')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('admin.products.upload.clickToPick')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
