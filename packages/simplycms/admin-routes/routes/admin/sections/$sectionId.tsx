import { createFileRoute } from '@tanstack/react-router';
import SectionEdit from '@simplycms/admin/pages/SectionEdit';

export const Route = createFileRoute('/admin/sections/$sectionId')({
  component: SectionEdit,
});
