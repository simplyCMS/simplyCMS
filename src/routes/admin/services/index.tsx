import { createFileRoute } from '@tanstack/react-router';
import PlaceholderPage from '@simplysoftua/admin/pages/PlaceholderPage';

export const Route = createFileRoute('/admin/services/')({
  ssr: false,
  component: PlaceholderPage,
});
