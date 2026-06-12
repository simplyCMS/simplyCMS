import { createFileRoute } from '@tanstack/react-router';
import Settings from '@simplysoftua/admin/pages/Settings';

export const Route = createFileRoute('/admin/settings/')({
  ssr: false,
  component: Settings,
});
