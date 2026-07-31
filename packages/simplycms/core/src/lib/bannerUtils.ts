import type { Tables } from '@simplycms/supabase';
import type { Banner, BannerButton } from '../hooks/useBanners';

/** Перетворює рядок Supabase banners на типізований Banner */
export function parseBannerRow(row: Tables<'banners'>): Banner {
  return {
    ...row,
    buttons: parseBannerButtons(row.buttons),
    schedule_days: Array.isArray(row.schedule_days)
      ? (row.schedule_days as number[])
      : null,
  };
}

function parseBannerButtons(raw: unknown): BannerButton[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isBannerButton);
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
