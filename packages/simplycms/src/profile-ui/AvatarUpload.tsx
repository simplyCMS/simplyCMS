import { useT } from 'simplycms/i18n';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  onUpdate?: (url: string | null) => void;
}

/**
 * 🔴 TODO(К4): завантаження аватара ВИМКНЕНЕ до порту сховища файлів.
 *
 * Аватар — це файл, а не рядок таблиці: завантаження, видалення старого
 * обʼєкта й публічний URL раніше давав Supabase Storage. Порту сховища
 * (`MediaProvider` з `delete`/`transform`) у контракті v2 ще немає — це
 * контур К4, поза цим етапом.
 *
 * 🔴 Тому компонент чесно відмовляє: показує поточний аватар/ініціали,
 * тримає `input[type=file]` вимкненим і пояснює причину видимим текстом.
 * Жодного `onUpload`, що «нічого не робить, але не скаржиться», — тихий
 * успіх на місці зламаного завантаження гірший за гучну відмову, бо ховає
 * відсутність цілого контуру за фальшивим позитивним UX.
 */
export function AvatarUpload({
  currentAvatarUrl,
  firstName,
  lastName,
  email,
}: AvatarUploadProps) {
  const t = useT();

  const getInitials = () => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || email?.[0]?.toUpperCase() || '?';
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">
        {t('profile.settings.avatar')}
      </label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-medium">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Avatar"
              width={96}
              height={96}
              className="rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            getInitials()
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            data-testid="avatar-file-input"
            accept="image/jpeg,image/png,image/webp"
            disabled
            className="hidden"
          />
          <p className="text-xs text-muted-foreground max-w-xs">
            {t('profile.avatar.unavailable')}
          </p>
        </div>
      </div>
    </div>
  );
}
