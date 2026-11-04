/**
 * Каркас магазину (host-`__root.tsx`): 404 і глобальний error boundary.
 *
 * Окремий неймспейс, а не `common`, бо ці рядки належать не домену, а самій
 * оболонці застосунку — тій частині, що їде в кожен новий магазин копією
 * шаблону `create-simplycms-store`. Хардкод тут означав би, що англомовний
 * магазин показує українську сторінку помилки.
 */
export const messages = {
  'app.notFound.title': '404',
  'app.notFound.message': 'Сторінку не знайдено',
  'app.error.title': 'Щось пішло не так',
  'app.error.fallback': 'Сталася непередбачувана помилка.',
  'app.error.reference': 'Код помилки: {id}',
  'app.error.reloading': 'Оновлюємо сторінку…',
  // Екрани `/admin` до завантаження частини `admin`: pending і errorComponent рендеряться
  // у кореневому провайдері, де є лише `base`, тож їхні рядки живуть тут.
  'app.admin.loading': 'Завантаження адмінки…',
  'app.error.insecureContext':
    'Адмінка працює лише в захищеному контексті (https:// або localhost).',
  'app.backHome': 'На головну',
} as const;
