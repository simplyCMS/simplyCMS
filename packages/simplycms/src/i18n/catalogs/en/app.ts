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
  'app.error.reference': 'Error reference: {id}',
  'app.error.reloading': 'Updating the page…',
  // Екрани `/admin` до завантаження частини `admin`: pending і errorComponent рендеряться
  // у кореневому провайдері, де є лише `base`, тож їхні рядки живуть тут.
  'app.admin.loading': 'Loading the admin panel…',
  'app.error.insecureContext':
    'The admin panel requires a secure context (https:// or localhost).',
  'app.backHome': 'Back to home',
} as const;
