import { createFileRoute } from '@tanstack/react-router';
import PriceTypeEdit from 'simplycms/admin/pages/PriceTypeEdit';

export const Route = createFileRoute('/admin/price-types/$priceTypeId')({
  component: PriceTypeEdit,
});
