declare const __SIMPLYCMS_BUILD_ID__: string | undefined;

/**
 * Ідентифікатор збірки, один для сервера й клієнта: `define` плагіна
 * `simplycms/vite` вшиває його в обидва бандли тієї самої збірки. Без `define`
 * (vitest, dev без збірки) — `'dev'`: вкладка й сервер там завжди одного коду.
 * Guard `typeof`, бо необвʼязаний глобал кинув би ReferenceError.
 */
export const BUILD_ID: string =
  typeof __SIMPLYCMS_BUILD_ID__ === 'string' ? __SIMPLYCMS_BUILD_ID__ : 'dev';
