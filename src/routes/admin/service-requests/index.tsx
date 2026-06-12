import { createFileRoute } from '@tanstack/react-router';
import PlaceholderPage from '@simplysoftua/admin/pages/PlaceholderPage';

export const Route = createFileRoute('/admin/service-requests/')({
  ssr: false,
  component: PlaceholderPage,
});
