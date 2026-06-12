import { createFileRoute } from '@tanstack/react-router';
import BannerEdit from '@simplysoftua/admin/pages/BannerEdit';

export const Route = createFileRoute('/admin/banners/$bannerId')({
  ssr: false,
  component: BannerEdit,
});
