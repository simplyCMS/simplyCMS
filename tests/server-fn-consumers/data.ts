/**
 * Винятки для `server-fn-consumers.test.ts`: ключ `<файл>#<імʼя>` → причина.
 * Запис додається лише з причиною, що називає адресата споживача (для serverFn мов —
 * «UI мов — М3»); мертвий запис (serverFn уже має споживача) червоніє в тесті.
 */
export const SERVER_FN_NO_CONSUMER_ALLOWLIST: Readonly<Record<string, string>> =
  {
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
    'packages/simplycms/src/admin-server/index.ts#saveProductTranslation':
      'М1: окрема команда перекладача — для /api/v1 і агента-перекладача (І13, джерельні хеші); UI картки зберігає переклади через saveProductDescription (І24)',
    'packages/simplycms/src/admin-server/index.ts#deleteProductTranslation':
      'М1: видалення перекладу однієї мови — для /api/v1 і CLI; UI картки в М1 мову не видаляє (кнопка — М3) (І24)',
    'packages/simplycms/src/admin-server/index.ts#setProductModificationToken':
      'М1: явна зміна токена вже збереженої модифікації — для /api/v1; UI картки шле токен у modifications.upsert.token (І24)',
    'packages/simplycms/src/admin-server/index.ts#createApiToken':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#listApiTokens':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#revokeApiToken':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
    'packages/simplycms/src/admin-server/index.ts#createServiceAccount':
      'М1: UI токенів — у М3; serverFn-обгортки операцій токенів (І24)',
  };
