import { createFileRoute } from '@tanstack/react-router';
import BannerEdit from '@simplycms/admin/pages/BannerEdit';

export const Route = createFileRoute('/admin/banners/$bannerId')({
  component: BannerEdit,
});
