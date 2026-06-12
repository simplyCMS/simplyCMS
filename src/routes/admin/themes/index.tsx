import { createFileRoute } from '@tanstack/react-router';
import Themes from '@simplysoftua/admin/pages/Themes';

export const Route = createFileRoute('/admin/themes/')({
  ssr: false,
  component: Themes,
});
