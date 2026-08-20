import { createFileRoute } from '@tanstack/react-router';
import Plugins from 'simplycms/admin/pages/Plugins';

export const Route = createFileRoute('/admin/plugins/')({
  component: Plugins,
});
