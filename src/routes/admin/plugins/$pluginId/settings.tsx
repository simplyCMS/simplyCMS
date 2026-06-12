import { createFileRoute } from '@tanstack/react-router';
import PluginSettings from '@simplysoftua/admin/pages/PluginSettings';

export const Route = createFileRoute('/admin/plugins/$pluginId/settings')({
  ssr: false,
  component: PluginSettings,
});
