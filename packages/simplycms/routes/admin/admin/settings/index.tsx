import { createFileRoute } from '@tanstack/react-router';
import Settings from 'simplycms/admin/pages/Settings';

export const Route = createFileRoute('/admin/settings/')({
  component: Settings,
});
