import { createFileRoute } from '@tanstack/react-router';
import PriceValidator from '@simplycms/admin/pages/PriceValidator';

export const Route = createFileRoute('/admin/price-validator/')({
  ssr: false,
  component: PriceValidator,
});
