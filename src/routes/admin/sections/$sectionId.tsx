import { createFileRoute } from '@tanstack/react-router';
import SectionEdit from '@simplysoftua/admin/pages/SectionEdit';

export const Route = createFileRoute('/admin/sections/$sectionId')({
  ssr: false,
  component: SectionEdit,
});
