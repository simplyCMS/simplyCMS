/**
 * Винятки для `server-fn-consumers.test.ts`: ключ `<файл>#<імʼя>` → причина.
 * Список лише скорочується (мертвий запис червоніє в тесті).
 */
export const SERVER_FN_NO_CONSUMER_ALLOWLIST: Readonly<Record<string, string>> =
  {
    'packages/simplycms/src/admin-server/index.ts#listLanguages':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
    'packages/simplycms/src/admin-server/index.ts#addLanguage':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
    'packages/simplycms/src/admin-server/index.ts#setLanguageStatus':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
    'packages/simplycms/src/admin-server/index.ts#fillLanguage':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
    'packages/simplycms/src/admin-server/index.ts#reorderLanguages':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
    'packages/simplycms/src/admin-server/index.ts#removeLanguage':
      'М1: UI мов — у М3; serverFn-обгортки операцій мов (І24)',
  };
