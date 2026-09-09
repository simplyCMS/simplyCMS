// Доменні типи банерів. Винесено з core/hooks/useBanners.

export interface BannerButton {
  text: string;
  url: string;
  target: '_self' | '_blank';
  variant: 'primary' | 'secondary' | 'outline';
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  buttons: BannerButton[];
  placement: string;
  section_id: string | null;
  sort_order: number;
  is_active: boolean;
  date_from: string | null;
  date_to: string | null;
  schedule_days: number[] | null;
  schedule_time_from: string | null;
  schedule_time_to: string | null;
  slide_duration: number;
  animation_type: string;
  animation_duration: number;
  overlay_color: string | null;
  text_position: string;
  created_at: string;
  updated_at: string;
}
