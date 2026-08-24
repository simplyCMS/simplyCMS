import { banners } from 'simplycms/schema';
import type { Banner, BannerButton } from 'simplycms/contracts';

/** Мапа select-а банера: доменний `Banner` вимагає рівно ці колонки. */
export const bannerColumns = {
  id: banners.id,
  title: banners.title,
  subtitle: banners.subtitle,
  image_url: banners.imageUrl,
  desktop_image_url: banners.desktopImageUrl,
  mobile_image_url: banners.mobileImageUrl,
  buttons: banners.buttons,
  placement: banners.placement,
  section_id: banners.sectionId,
  sort_order: banners.sortOrder,
  is_active: banners.isActive,
  date_from: banners.dateFrom,
  date_to: banners.dateTo,
  schedule_days: banners.scheduleDays,
  schedule_time_from: banners.scheduleTimeFrom,
  schedule_time_to: banners.scheduleTimeTo,
  slide_duration: banners.slideDuration,
  animation_type: banners.animationType,
  animation_duration: banners.animationDuration,
  overlay_color: banners.overlayColor,
  text_position: banners.textPosition,
  created_at: banners.createdAt,
  updated_at: banners.updatedAt,
};

/** Рядок банера до нормалізації: `buttons` — нетипізований jsonb. */
type RawBannerRow = Omit<Banner, 'buttons' | 'schedule_days'> & {
  buttons: unknown;
  schedule_days: number[] | null;
};

/**
 * Доводить рядок БД до доменного `Banner`.
 *
 * 🔴 `buttons` фільтруються поелементно, а не кастуються. Це jsonb, який
 * редагує адмінка: один запис старої форми зробив би `banner.buttons.map`
 * джерелом `undefined.text` у рендері слайдера — тобто впав би не тут, а на
 * вітрині покупця.
 */
export function toBanner(row: RawBannerRow): Banner {
  return {
    ...row,
    buttons: Array.isArray(row.buttons)
      ? row.buttons.filter(isBannerButton)
      : [],
    schedule_days: Array.isArray(row.schedule_days) ? row.schedule_days : null,
  };
}

function isBannerButton(item: unknown): item is BannerButton {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.text === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.target === 'string' &&
    typeof obj.variant === 'string'
  );
}
