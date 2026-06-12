import { createFileRoute } from '@tanstack/react-router';
import PriceTypes from '@simplysoftua/admin/pages/PriceTypes';

export const Route = createFileRoute('/admin/price-types/')({
  ssr: false,
  component: PriceTypes,
});
