import { banners } from 'simplycms/schema';
import type { Banner } from 'simplycms/contracts';
import { isBannerButton } from 'simplycms/domain';
import { resolveMediaUrl } from 'simplycms/domain/media';

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
type RawBannerRow = Omit<
  Banner,
  'buttons' | 'schedule_days' | 'placement' | 'animation_type' | 'text_position'
> & {
  placement: string;
  animation_type: string;
  text_position: string;
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
    // В БД CHECK-ів на ці колонки немає, тож значення поза enum можливе (прямий
    // SQL). Кастуємо, а не відкидаємо банер: тема мусить мати fallback.
    placement: row.placement as Banner['placement'],
    animation_type: row.animation_type as Banner['animation_type'],
    text_position: row.text_position as Banner['text_position'],
    // Три медіа-колонки банера — той самий референс-контракт, що й у товару.
    // `image_url` в контракті обовʼязковий (NOT NULL у схемі), тож fallback
    // на вихідне значення — лише страховка від порожнього рядка, не бізнес-логіка.
    image_url: resolveMediaUrl(row.image_url) ?? row.image_url,
    desktop_image_url: resolveMediaUrl(row.desktop_image_url),
    mobile_image_url: resolveMediaUrl(row.mobile_image_url),
    buttons: Array.isArray(row.buttons)
      ? row.buttons.filter(isBannerButton)
      : [],
    schedule_days: Array.isArray(row.schedule_days) ? row.schedule_days : null,
  };
}

/**
 * Чи показується банер саме зараз.
 *
 * 🔴 Розклад рахується на СЕРВЕРІ й за його годинником. Раніше це робив
 * браузер: банер «щодня 9:00–18:00» показувався по локальному часу
 * відвідувача, тож той самий банер у Києві й Ванкувері вмикався в різні
 * моменти доби. Час магазину — час його сервера, а не гостя.
 *
 * `date_from`/`date_to` — мітки часу (порівнюються як миті), а
 * `schedule_days`/`schedule_time_*` — правило доби, тож вони й читаються
 * як день тижня й «години:хвилини».
 */
export function isBannerVisible(banner: Banner, now: Date): boolean {
  if (banner.date_from && banner.date_from > now) return false;
  if (banner.date_to && banner.date_to < now) return false;

  if (
    banner.schedule_days?.length &&
    !banner.schedule_days.includes(now.getDay())
  )
    return false;

  if (banner.schedule_time_from && banner.schedule_time_to) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const current = `${hh}:${mm}`;
    // Postgres `time` приходить як `HH:MM:SS`; порівняння рядків `09:00` з
    // `09:00:00` ховало б банер рівно о першій хвилині вікна. Хвилинна
    // точність, обидві межі включно.
    if (
      current < banner.schedule_time_from.slice(0, 5) ||
      current > banner.schedule_time_to.slice(0, 5)
    )
      return false;
  }
  return true;
}
