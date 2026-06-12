import { createFileRoute } from '@tanstack/react-router';
import Sections from '@simplysoftua/admin/pages/Sections';

export const Route = createFileRoute('/admin/sections/')({
  ssr: false,
  component: Sections,
});
