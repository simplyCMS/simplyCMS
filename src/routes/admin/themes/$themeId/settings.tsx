import { createFileRoute } from '@tanstack/react-router';
import ThemeSettings from '@simplycms/admin/pages/ThemeSettings';

export const Route = createFileRoute('/admin/themes/$themeId/settings')({
  ssr: false,
  component: ThemeSettings,
});
