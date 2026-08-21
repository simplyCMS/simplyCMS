import { createFileRoute } from '@tanstack/react-router';
import PlaceholderPage from 'simplycms/admin/pages/PlaceholderPage';

export const Route = createFileRoute('/admin/service-requests/')({
  component: PlaceholderPage,
});
