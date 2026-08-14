import { createFileRoute } from '@tanstack/react-router';
import FaqAdmin from '@simplycms/plugin-faq/pages/FaqAdmin';

// Запечений id під фіксований mount-prefix (контракт physical()-монтажу):
// роут стає дитиною layout `/admin` — guard і AdminLayout успадковуються.
export const Route = createFileRoute('/admin/faq/')({
  component: FaqAdmin,
});
