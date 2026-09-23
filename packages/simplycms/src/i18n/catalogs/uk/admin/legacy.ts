/**
 * Легасі-сторінки адмінки (`admin/pages/**` на `supabase-js`), яких контракт
 * env магазину (0.4.1) не годує ключами — заглушка замість падіння
 * (`admin/layouts/LegacySupabaseBoundary`, К3-Е3 Step 0).
 */
export const messages = {
  'admin.legacy.notMigrated':
    'Цей розділ ще не перенесено на V2. Скористайтесь одним із живих розділів нижче.',
} as const;
