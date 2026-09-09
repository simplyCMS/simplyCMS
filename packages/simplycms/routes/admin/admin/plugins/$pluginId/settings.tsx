import { createFileRoute } from '@tanstack/react-router';
import PluginSettings from 'simplycms/admin/pages/PluginSettings';

export const Route = createFileRoute('/admin/plugins/$pluginId/settings')({
  component: PluginSettings,
});
