import { createFileRoute } from '@tanstack/react-router';
import Themes from '@simplycms/admin/pages/Themes';

export const Route = createFileRoute('/admin/themes/')({
  component: Themes,
});
