import { createFileRoute, redirect } from '@tanstack/react-router';

// Огляд доставки знесено (Е6а-2): розділ відкривається зі способів.
export const Route = createFileRoute('/admin/shipping/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/shipping/methods' });
  },
});
