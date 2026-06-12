import { createFileRoute } from '@tanstack/react-router';
import PriceTypeEdit from '@simplysoftua/admin/pages/PriceTypeEdit';

export const Route = createFileRoute('/admin/price-types/$priceTypeId')({
  ssr: false,
  component: PriceTypeEdit,
});
