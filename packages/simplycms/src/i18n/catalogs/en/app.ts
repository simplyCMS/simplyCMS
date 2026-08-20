/**
 * Application shell (host `__root.tsx`): 404 and the global error boundary.
 *
 * A namespace of its own rather than `common`: these strings belong to the
 * shell, not to a domain — the part copied into every new store by the
 * `create-simplycms-store` template.
 */
export const messages = {
  'app.notFound.title': '404',
  'app.notFound.message': 'Page not found',
  'app.error.title': 'Something went wrong',
  'app.error.fallback': 'An unexpected error occurred.',
  'app.backHome': 'Back to home',
} as const;
