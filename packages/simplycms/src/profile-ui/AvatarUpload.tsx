import { useRef, useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { ACCEPT_ATTRIBUTE, MAX_AVATAR_BYTES } from 'simplycms/domain/media';
import { AvatarPreview } from './AvatarPreview';
import {
  removeMyAvatar,
  uploadMyAvatar,
} from 'simplycms/core/lib/profile-avatar';

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** Новий URL або `null` після видалення. */
  onUpdate: (url: string | null) => void;
}

/**
 * Аватар покупця — ПЕРШИЙ живий споживач порту сховища (рішення Е2-6).
 *
 * 🔴 До Е2 компонент чесно відмовляв: порту не було, а тихий «успіх» на
 * місці зламаного завантаження гірший за гучну відмову. Тепер відмова
 * знята, бо контур справді працює: браузер → serverFn → файл на диску →
 * `/media/<key>` → `<img>`.
 *
 * 🔴 Файл їде `FormData`-ою, а не base64-рядком: Start підтримує FormData
 * у serverFn нативно, а base64 роздув би тіло на третину й утримував би
 * цілий файл у памʼяті двічі.
 */
export function AvatarUpload({
  currentAvatarUrl,
  firstName,
  lastName,
  email,
  onUpdate,
}: AvatarUploadProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials =
    ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    '?';

  // Машинні коди сервера → рядки каталогу. Розкладка тут, а не на сервері:
  // серверний хендлер живе поза React і транслятора не має.
  const messageFor = (cause: unknown): string => {
    const code = cause instanceof Error ? cause.message : '';
    if (code === 'avatar/bad-format') return t('profile.avatar.badFormat');
    if (code === 'avatar/too-large') return t('profile.avatar.tooLarge');
    return t('profile.avatar.failed');
  };

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Локальна перевірка розміру — щоб не вантажити 50 МБ і не чекати
    // відмови сервера; сервер перевіряє те саме й лишається джерелом правди.
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t('profile.avatar.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const { url } = await uploadMyAvatar({ data: body });
      onUpdate(url);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      await removeMyAvatar();
      onUpdate(null);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <AvatarPreview
          url={currentAvatarUrl}
          initials={initials}
          alt={t('profile.settings.avatar')}
        />
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="avatar-file-input">
            {t('profile.settings.avatar')}
          </label>
          <input
            id="avatar-file-input"
            ref={inputRef}
            type="file"
            data-testid="avatar-file-input"
            accept={ACCEPT_ATTRIBUTE}
            disabled={busy}
            className="hidden"
            onChange={(e) => void handleSelect(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('profile.avatar.uploading') : t('profile.avatar.upload')}
          </Button>
          {currentAvatarUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              {t('profile.avatar.remove')}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {t('profile.avatar.allowedFormats')} · {t('profile.avatar.maxSize')}
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
