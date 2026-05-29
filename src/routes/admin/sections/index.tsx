import { createFileRoute } from '@tanstack/react-router';
import Sections from '@simplycms/admin/pages/Sections';

export const Route = createFileRoute('/admin/sections/')({
  ssr: false,
  component: Sections,
});
