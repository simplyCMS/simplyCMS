import { createFileRoute, redirect } from '@tanstack/react-router';

// Огляд доставки знесено: розділ відкривається зі способів.
export const Route = createFileRoute('/admin/shipping/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/shipping/methods' });
  },
});
