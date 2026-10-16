/**
 * Винятки для `server-fn-consumers.test.ts`: ключ `<файл>#<імʼя>` → причина.
 * Запис додається лише з причиною, що називає адресата споживача (для serverFn мов —
 * «UI мов — М3»); мертвий запис (serverFn уже має споживача) червоніє в тесті.
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
    'packages/simplycms/src/admin-server/index.ts#createProduct':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#getProduct':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#saveProductDescription':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#saveProductTranslation':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#deleteProductTranslation':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#setProductPath':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#removeProduct':
      'М1: UI товару — у наступних задачах М1; serverFn-обгортки операцій products.* (І24)',
    'packages/simplycms/src/admin-server/index.ts#createApiToken':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#listApiTokens':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#revokeApiToken':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#createServiceAccount':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
  };
