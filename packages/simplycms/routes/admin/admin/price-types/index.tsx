import { createFileRoute } from '@tanstack/react-router';
import PriceTypes from 'simplycms/admin/pages/PriceTypes';

export const Route = createFileRoute('/admin/price-types/')({
  component: PriceTypes,
});
