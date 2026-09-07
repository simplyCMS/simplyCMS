import { useThemeSettings } from "@/lib/themes";

export function AnnouncementBar() {
  const show = useThemeSettings<boolean>("showAnnouncementBar");
  const text = useThemeSettings<string>("announcementBarText");

  if (!show) return null;

  return (
    <div className="w-full py-2 text-center text-xs tracking-wide text-muted-foreground border-b border-border/50">
      {text || "При сумі замовлення понад 1500 грн — доставка безкоштовна!"}
    </div>
  );
}
