import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">SimplyCMS</h1>
        <p className="mt-4 text-muted-foreground">
          TanStack Start migration — Phase 1 placeholder
        </p>
      </div>
    </div>
  );
}
