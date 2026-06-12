import { createFileRoute } from '@tanstack/react-router';
import PropertyOptionEdit from '@simplysoftua/admin/pages/PropertyOptionEdit';

export const Route = createFileRoute(
  '/admin/properties/$propertyId/options/$optionId',
)({
  ssr: false,
  component: PropertyOptionEdit,
});
