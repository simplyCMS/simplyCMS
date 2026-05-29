import { createFileRoute } from '@tanstack/react-router';
import Banners from '@simplycms/admin/pages/Banners';

export const Route = createFileRoute('/admin/banners/')({
  ssr: false,
  component: Banners,
});
