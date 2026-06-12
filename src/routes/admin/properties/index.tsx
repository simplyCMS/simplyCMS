import { createFileRoute } from '@tanstack/react-router';
import Properties from '@simplysoftua/admin/pages/Properties';

export const Route = createFileRoute('/admin/properties/')({
  ssr: false,
  component: Properties,
});
