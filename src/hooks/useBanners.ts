import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BannerButton {
  text: string;
  url: string;
  target: "_self" | "_blank";
  variant: "primary" | "secondary" | "outline";
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

function isBannerVisible(banner: Banner): boolean {
  const now = new Date();

  // Check date range
  if (banner.date_from && new Date(banner.date_from) > now) return false;
  if (banner.date_to && new Date(banner.date_to) < now) return false;

  // Check day of week (0=Sun ... 6=Sat)
  if (banner.schedule_days && banner.schedule_days.length > 0) {
    const today = now.getDay();
    if (!banner.schedule_days.includes(today)) return false;
  }

  // Check time range
  if (banner.schedule_time_from && banner.schedule_time_to) {
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (currentTime < banner.schedule_time_from || currentTime > banner.schedule_time_to) return false;
  }

  return true;
}

export function useBanners(placement: string, sectionId?: string) {
  return useQuery({
    queryKey: ["banners", placement, sectionId],
    queryFn: async () => {
      let query = supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .eq("placement", placement)
        .order("sort_order");

      if (sectionId) {
        query = query.eq("section_id", sectionId);
      }

      const { data } = await query;
      if (!data) return [];

      const banners: Banner[] = data.map((b) => ({
        ...b,
        buttons: (Array.isArray(b.buttons) ? b.buttons : []) as unknown as BannerButton[],
        schedule_days: b.schedule_days as number[] | null,
      }));

      return banners.filter(isBannerVisible);
    },
  });
}
