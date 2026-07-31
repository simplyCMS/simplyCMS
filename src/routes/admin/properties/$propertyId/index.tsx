import { createFileRoute } from '@tanstack/react-router';
import PropertyEdit from '@simplycms/admin/pages/PropertyEdit';

export const Route = createFileRoute('/admin/properties/$propertyId/')({
  ssr: false,
  component: PropertyEdit,
});
