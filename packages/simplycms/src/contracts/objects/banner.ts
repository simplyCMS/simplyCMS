// Доменні типи банерів. Винесено з core/hooks/useBanners.
//
// Масиви enum — КАНОН у T0 (Е6д-10): union контракту виводиться з того самого
// масиву, з якого предикати T1 (`domain/banner.ts`) і форма адмінки беруть
// значення. T0 не імпортує T1, тож масиви живуть тут.

export const BANNER_PLACEMENTS = [
  'home',
  'catalog',
  'section',
  'blog',
  'global',
] as const;
export const BANNER_TEXT_POSITIONS = ['left', 'center', 'right'] as const;
export const BANNER_ANIMATIONS = ['slide', 'fade', 'zoom', 'none'] as const;
export const BANNER_BUTTON_TARGETS = ['_self', '_blank'] as const;
export const BANNER_BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'outline',
] as const;

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];
export type BannerTextPosition = (typeof BANNER_TEXT_POSITIONS)[number];
export type BannerAnimation = (typeof BANNER_ANIMATIONS)[number];

export interface BannerButton {
  text: string;
  url: string;
  target: (typeof BANNER_BUTTON_TARGETS)[number];
  variant: (typeof BANNER_BUTTON_VARIANTS)[number];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  buttons: BannerButton[];
  placement: BannerPlacement;
  section_id: string | null;
  sort_order: number;
  is_active: boolean;
  date_from: Date | null;
  date_to: Date | null;
  schedule_days: number[] | null;
  schedule_time_from: string | null;
  schedule_time_to: string | null;
  slide_duration: number;
  animation_type: BannerAnimation;
  animation_duration: number;
  overlay_color: string | null;
  text_position: BannerTextPosition;
  created_at: Date;
  updated_at: Date;
}
