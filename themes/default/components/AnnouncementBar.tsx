import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { DefaultThemeKey } from '../messages';

export function AnnouncementBar() {
  const tt = useThemeT<DefaultThemeKey>();
  const show = useThemeSettings<boolean>('showAnnouncementBar');
  const text = useThemeSettings<string>('announcementBarText');

  if (!show) return null;

  return (
    <div className="w-full py-2 text-center text-xs tracking-wide text-muted-foreground border-b border-border/50">
      {text || tt('theme.announcementBar.default')}
    </div>
  );
}
