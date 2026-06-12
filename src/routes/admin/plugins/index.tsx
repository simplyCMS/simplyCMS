import { createFileRoute } from '@tanstack/react-router';
import Plugins from '@simplysoftua/admin/pages/Plugins';

export const Route = createFileRoute('/admin/plugins/')({
  ssr: false,
  component: Plugins,
});
