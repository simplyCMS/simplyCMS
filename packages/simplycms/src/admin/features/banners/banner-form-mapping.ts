import { isBannerButton } from 'simplycms/domain';
import type { Banner } from 'simplycms/schema/types';
import { toDateTimeLocal } from '../../lib/datetime-local';
import type { BannerFormValues } from './banner-form-schema';

/** `HH:MM:SS` з Postgres → `HH:MM` для поля часу. */
const hhmm = (v: string | null) => (v ? v.slice(0, 5) : '');

/** `buttons` — `JsonValue`: елементи звужує `isBannerButton`, а не каст. */
const rawButtons = (row: Banner): readonly unknown[] =>
  Array.isArray(row.buttons) ? row.buttons : [];

/** Рядок колекції → форма. `buttons` — `JsonValue`: звужуємо предикатом, не кастом. */
export function toFormValues(row: Banner): BannerFormValues {
  return {
    title: row.title,
    subtitle: row.subtitle ?? '',
    imageUrl: row.imageUrl,
    desktopImageUrl: row.desktopImageUrl ?? '',
    mobileImageUrl: row.mobileImageUrl ?? '',
    textPosition: row.textPosition as BannerFormValues['textPosition'],
    overlayColor: row.overlayColor ?? '',
    buttons: rawButtons(row).filter(isBannerButton),
    placement: row.placement as BannerFormValues['placement'],
    sectionId: row.sectionId ?? '',
    dateFrom: toDateTimeLocal(row.dateFrom),
    dateTo: toDateTimeLocal(row.dateTo),
    scheduleDays: row.scheduleDays ?? [],
    scheduleTimeFrom: hhmm(row.scheduleTimeFrom),
    scheduleTimeTo: hhmm(row.scheduleTimeTo),
    slideDuration: row.slideDuration,
    animationType: row.animationType as BannerFormValues['animationType'],
    animationDuration: row.animationDuration,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** Форма → колонки (без дат: їх веде хук, щоб не втратити незмінений `Date`). */
export function toFields(v: BannerFormValues) {
  return {
    title: v.title,
    subtitle: v.subtitle.trim() || null,
    imageUrl: v.imageUrl,
    desktopImageUrl: v.desktopImageUrl || null,
    mobileImageUrl: v.mobileImageUrl || null,
    textPosition: v.textPosition,
    overlayColor: v.overlayColor.trim() || null,
    buttons: v.buttons.map((b) => ({
      ...b,
      text: b.text.trim(),
      url: b.url.trim(),
    })),
    placement: v.placement,
    // Розділ має сенс лише для placement='section' (перехресне правило guard).
    sectionId: v.placement === 'section' ? v.sectionId : null,
    scheduleDays: v.scheduleDays.length > 0 ? [...v.scheduleDays].sort() : null,
    scheduleTimeFrom: v.scheduleTimeFrom || null,
    scheduleTimeTo: v.scheduleTimeTo || null,
    slideDuration: v.slideDuration,
    animationType: v.animationType,
    animationDuration: v.animationDuration,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
  };
}

/**
 * Лише змінені поля (як `useDiscountGroupCard`): масиви в draft завжди нові
 * посилання, тож порівнюємо за значенням, а не покладаємось на diff колекції.
 * 🔴 Зміна `placement` несе `sectionId` завжди: guard бачить злитий рядок, і
 * `{ placement: 'home' }` без `sectionId: null` він відхилить (р4 B3).
 */
export function changedFields(row: Banner, v: BannerFormValues) {
  const before: Record<string, unknown> = toFields(toFormValues(row));
  const next: Record<string, unknown> = toFields(v);
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(next))
    if (JSON.stringify(next[k]) !== JSON.stringify(before[k]))
      patch[k] = next[k];
  if ('placement' in patch) patch.sectionId = next.sectionId;
  return patch;
}
